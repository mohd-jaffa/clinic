import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listActivity } from "@/features/activity/api";
import { changeLines, describeActivity } from "@/features/activity/describe";
import { createExpense } from "@/features/expenses/api";
import { recordPayment } from "@/features/billing/payments";
import { createPatient } from "@/features/patients/api";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { expenseSchema, patientSchema, paymentSchema } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  setValidUntil,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The owner's activity log (plan §19; R11.6, D387 – D390), against the local
 * Supabase: what the team did, through the app's own functions, is read back
 * the latest first — each row with its patient by name and number and the
 * record it names — kept to a person and a kind; a view-only clinic's too;
 * and no one but the clinic's own owner reads it.
 */
let clinic: TestClinic;
let other: TestClinic;
let desk: SignedIn;
let patient: { id: string; number: number };
const today = todayKey();

beforeAll(async () => {
  [clinic, other] = await Promise.all([registerClinic({ fullName: "Asha Menon" }), registerClinic()]);
  desk = await addMember(clinic.clinicId, {
    permissions: [
      "patients.view",
      "patients.create",
      "payments.view",
      "payments.create",
      "expenses.view",
      "expenses.create",
    ],
  });
  patient = await createPatient(
    clinic.owner.tenant,
    patientSchema.parse({
      fullName: "Meena Iyer",
      phone: "99000 11223",
      born: { as: "AGE", years: "41" },
      gender: "FEMALE",
    }),
    randomUUID(),
  );
  await recordPayment(
    desk.tenant!,
    paymentSchema.parse({
      patientId: patient.id,
      kind: "PAYMENT",
      amount: "1,300",
      paidOn: today,
      method: "CASH",
      reference: "",
      note: "",
    }),
    randomUUID(),
  );
  const { data: rent } = await admin()
    .from("expense_categories")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("name", "Rent")
    .single();
  await createExpense(
    desk.tenant!,
    expenseSchema.parse({ categoryId: rent!.id, amount: "500", day: today, method: "UPI", description: "" }),
    randomUUID(),
  );
});

afterAll(removeAll);

describe("the owner's activity log (plan §19)", () => {
  it("reads what was done the latest first, each with its patient by name and number and what it names", async () => {
    const { items } = await listActivity(clinic.owner.tenant, {});
    expect(items.map(describeActivity)).toEqual([
      "Added an expense of ₹500 · Rent",
      "Recorded a payment of ₹1,300 · Cash",
      "Added a patient",
      "Signed up the clinic",
    ]);
    const [expense, payment, added] = items;
    expect(payment).toMatchObject({
      actorName: desk.session.profile.fullName,
      patient: { id: patient.id, number: patient.number, name: "Meena Iyer" },
      record: { kind: "PAYMENT", amount_paise: 130_000 },
    });
    expect(added).toMatchObject({ actorName: "Asha Menon", patient: { id: patient.id, name: "Meena Iyer" } });
    // The category its change points at, by name.
    expect(changeLines(expense)).toContainEqual({ label: "Category", value: "Rent" });
  });

  it("keeps to a person, a kind, or both", async () => {
    const theirs = await listActivity(clinic.owner.tenant, { person: desk.userId });
    expect(theirs.items.map(describeActivity)).toEqual([
      "Added an expense of ₹500 · Rent",
      "Recorded a payment of ₹1,300 · Cash",
    ]);
    const patients = await listActivity(clinic.owner.tenant, { kind: "PATIENTS" });
    expect(patients.items.map(describeActivity)).toEqual(["Added a patient"]);
    const both = await listActivity(clinic.owner.tenant, { person: desk.userId, kind: "BILLING" });
    expect(both.items.map(describeActivity)).toEqual(["Recorded a payment of ₹1,300 · Cash"]);
    expect((await listActivity(clinic.owner.tenant, { person: desk.userId, kind: "TEAM" })).items).toEqual([]);
  });

  it("is read in a view-only clinic", async () => {
    await setValidUntil(clinic.clinicId, addDaysKey(today, -60));
    try {
      expect((await listActivity(clinic.owner.tenant, {})).items).toHaveLength(4);
    } finally {
      await setValidUntil(clinic.clinicId, addDaysKey(today, 30));
    }
  });

  it("is the clinic's own owner's alone", async () => {
    await expect(listActivity(desk.tenant!, {})).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    const theirs = await listActivity(other.owner.tenant, {});
    expect(theirs.items.map(describeActivity)).toEqual(["Signed up the clinic"]);
    // Not even by asking for this clinic's people.
    expect((await listActivity(other.owner.tenant, { person: desk.userId })).items).toEqual([]);
  });
});
