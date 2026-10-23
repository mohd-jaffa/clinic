import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn, getAppointment, listQueue } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { getBillStart, issueBill } from "@/features/billing/api";
import { billSchema, walkInSchema } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Where a new bill starts, and issuing it from the screen's feature
 * functions (plan §15.2, §11.3; R8.3, D283, D285, D286, D305, D306, D313):
 * bill_start reads, for whoever may issue a bill — reception, who may not
 * open visits — a visit's patient, doctor and fee, its treatments not yet
 * billed and whether its consultation is; an arrival's token; a patient's
 * oldest visit to bill; within the doctor scope and the clinic. A
 * patient's bill starts on their assigned doctor, lists the doctors to pick
 * and is priced by the one picked (R8.8, D326, D342); the patient's mobile
 * comes for WhatsApp (D341). issueBill sends the totals by billing/totals.ts
 * and audits; the queue and an appointment say Fee paid.
 */
type Member = SignedIn & { memberId: string };

/** Reception's preset: bills, no visits (plan §8.3). */
const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "payments.view",
  "payments.create",
];
const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit", "payments.create"];

let clinic: TestClinic;
let other: TestClinic;
let desk: Member;
let maya: Member;
let arun: Member;
let viewer: Member;
let mayaDoctor: string;
let arunDoctor: string;
let consultationType: string;
let consultation: string;
let rootCanal: string;

const FEE = 80_000;

async function addPatient(name: string) {
  const { data, error } = await desk
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  return data.patient_id;
}

async function arrived(patientId: string, doctorId = mayaDoctor) {
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultationType }),
    randomUUID(),
  );
  return { appointmentId: arrival.id, token: arrival.token };
}

/** A bill as the screen sends it, parsed as the route parses it. */
const aBill = (input: Record<string, unknown>) =>
  billSchema.parse({
    visitId: null,
    appointmentId: null,
    discount: { kind: "NONE" },
    notes: "",
    collect: { on: false },
    ...input,
  });

const consultationLine = (price = "800") => ({
  kind: "SERVICE",
  serviceId: consultation,
  treatmentId: null,
  quantity: 1,
  price,
});

beforeAll(async () => {
  [clinic, other] = await Promise.all([registerClinic({ fullName: "Asha Menon" }), registerClinic()]);
  [desk, maya, arun, viewer] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "payments.view"] }),
  ]);
  const fee = async (member: Member, paise: number | null) =>
    (
      await admin()
        .from("doctors")
        .update({ consultation_fee_paise: paise })
        .eq("member_id", member.memberId)
        .select("id")
        .single()
    ).data!.id as string;
  [mayaDoctor, arunDoctor] = await Promise.all([fee(maya, FEE), fee(arun, null)]);

  const [{ data: type }, { data: seeded }, { data: procedure }] = await Promise.all([
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
    admin()
      .from("services")
      .update({ price_paise: 50_000 })
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .select("id")
      .single(),
    admin()
      .from("services")
      .insert({
        clinic_id: clinic.clinicId,
        name: "Root canal",
        category: "PROCEDURE",
        price_paise: 600_000,
        active: true,
      })
      .select("id")
      .single(),
  ]);
  consultationType = type!.id as string;
  consultation = seeded!.id as string;
  rootCanal = procedure!.id as string;
});

afterAll(removeAll);

describe("bill_start (plan §15.2; D285, D286, D313)", () => {
  it("reads a visit for reception, who may not open it: its doctor's fee, its treatments, its consultation unbilled", async () => {
    const patientId = await addPatient("Rohan Mehta");
    const { appointmentId } = await arrived(patientId);
    const { visitId } = await sendIn(desk.tenant!, { appointmentId, others: "KEEP" });
    const { error } = await maya.tenant!.supabase.rpc("create_treatment", {
      p_treatment: { name: "Root canal", status: "IN_PROGRESS" },
      p_visit_id: visitId,
    });
    expect(error).toBeNull();
    await markDone(desk.tenant!, { appointmentId });

    // Reception reads no visit of its own…
    const { data: visible } = await desk.tenant!.supabase.from("visits").select("id").eq("id", visitId);
    expect(visible).toEqual([]);
    // …and starts its bill all the same.
    const start = await getBillStart(desk.tenant!, { visit: visitId });
    expect(start).toEqual({
      patient: expect.objectContaining({ id: patientId, name: "Rohan Mehta", archived: false }),
      visit: expect.objectContaining({ id: visitId, status: "COMPLETED", billingStatus: "TO_BILL" }),
      appointment: null,
      doctor: { id: mayaDoctor, name: expect.any(String), feePaise: FEE },
      doctors: [],
      consultationBilled: false,
      treatments: [{ id: expect.any(String), name: "Root canal" }],
      balancePaise: 0,
      toBill: null,
    });

    // From the patient: their visit to bill (D313).
    expect((await getBillStart(desk.tenant!, { patient: patientId })).toBill).toEqual({
      visitId,
      day: start.visit!.day,
    });

    // Billed with its treatment, nothing of it is suggested again (D286).
    const issued = await issueBill(
      desk.tenant!,
      aBill({
        patientId,
        visitId,
        lines: [
          consultationLine(),
          { kind: "SERVICE", serviceId: rootCanal, treatmentId: start.treatments[0].id, quantity: 1, price: "6000" },
        ],
        collect: { on: true, amount: "6000", method: "UPI", reference: "UTR 1" },
      }),
      randomUUID(),
      "req_bill_start",
    );
    expect(issued).toMatchObject({ totalPaise: 680_000, collectedPaise: 600_000, balancePaise: 80_000 });
    const after = await getBillStart(desk.tenant!, { visit: visitId });
    expect(after).toMatchObject({
      visit: { billingStatus: "BILLED" },
      consultationBilled: true,
      treatments: [],
      balancePaise: 80_000,
    });
    expect((await getBillStart(desk.tenant!, { patient: patientId })).toBill).toBeNull();

    const { data: audit } = await admin()
      .from("audit_logs")
      .select("entity_type, action, changes")
      .eq("request_id", "req_bill_start")
      .order("entity_type");
    expect(audit).toEqual([
      expect.objectContaining({ entity_type: "bills", action: "CREATE" }),
      expect.objectContaining({
        entity_type: "payments",
        changes: expect.objectContaining({ amount_paise: { from: null, to: 600_000 } }),
      }),
      expect.objectContaining({
        entity_type: "visits",
        changes: { billing_status: { from: "TO_BILL", to: "BILLED" } },
      }),
    ]);
  });

  it("reads an arrival's token, and says Fee paid once its fee is in — on the queue and the appointment (D306)", async () => {
    const patientId = await addPatient("Meera Pillai");
    const { appointmentId, token } = await arrived(patientId);
    const start = await getBillStart(desk.tenant!, { appointment: appointmentId });
    expect(start).toMatchObject({
      visit: null,
      appointment: { id: appointmentId, status: "ARRIVED", token },
      doctor: { id: mayaDoctor, feePaise: FEE },
      consultationBilled: false,
    });
    const before = (await listQueue(desk.tenant!, {})).find((row) => row.id === appointmentId)!;
    expect(before.feePaid).toBe(false);

    await issueBill(
      desk.tenant!,
      aBill({
        patientId,
        appointmentId,
        lines: [consultationLine()],
        collect: { on: true, amount: "800", method: "CASH", reference: "" },
      }),
      randomUUID(),
    );
    expect((await getBillStart(desk.tenant!, { appointment: appointmentId })).consultationBilled).toBe(true);
    expect((await listQueue(desk.tenant!, {})).find((row) => row.id === appointmentId)!.feePaid).toBe(true);
    expect((await getAppointment(desk.tenant!, appointmentId)).feePaid).toBe(true);

    // Its fee voided, the fee is not paid.
    const { data: bill } = await admin().from("bills").select("id").eq("appointment_id", appointmentId).single();
    const { error } = await clinic.owner.tenant.supabase.rpc("void_bill", { p_bill_id: bill!.id, p_reason: "Wrong" });
    expect(error).toBeNull();
    expect((await getAppointment(desk.tenant!, appointmentId)).feePaid).toBe(false);
  });

  it("reads a doctor with no fee of their own as none, and a patient with nothing to bill", async () => {
    const patientId = await addPatient("Kiran Das");
    const { appointmentId } = await arrived(patientId, arunDoctor);
    expect((await getBillStart(desk.tenant!, { appointment: appointmentId })).doctor).toMatchObject({
      id: arunDoctor,
      feePaise: null,
    });
    expect(await getBillStart(desk.tenant!, { patient: patientId })).toMatchObject({
      visit: null,
      appointment: null,
      doctor: null,
      treatments: [],
      toBill: null,
    });
  });

  it("is for payments.create alone, within the doctor scope and the clinic", async () => {
    const patientId = await addPatient("Nisha Rao");
    await expect(getBillStart(viewer.tenant!, { patient: patientId })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    // Arun has never seen her.
    await expect(getBillStart(arun.tenant!, { patient: patientId })).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
    await expect(getBillStart(other.owner.tenant, { patient: patientId })).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
    await expect(getBillStart(desk.tenant!, { patient: randomUUID() })).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
    const { error } = await desk.tenant!.supabase.rpc("bill_start", {
      p_visit_id: null,
      p_appointment_id: null,
      p_patient_id: null,
    });
    expect(error?.hint).toBe("VALIDATION_ERROR");
  });

  it("says an archived patient is, so nothing is issued", async () => {
    const patientId = await addPatient("Old Patient");
    await admin().from("patients").update({ archived_at: new Date().toISOString() }).eq("id", patientId);
    expect((await getBillStart(desk.tenant!, { patient: patientId })).patient.archived).toBe(true);
    await expect(
      issueBill(desk.tenant!, aBill({ patientId, lines: [consultationLine("500")] }), randomUUID()),
    ).rejects.toMatchObject({ code: "PATIENT_ARCHIVED" });
  });
});

describe("a patient's bill's doctor (plan §15.2, §18; R8.8, D326, D341, D342)", () => {
  it("starts on their assigned doctor, with the clinic's doctors and their fees to pick from, and their mobile", async () => {
    const patientId = await addPatient("Zara Khan");
    await admin().from("patients").update({ assigned_doctor_id: mayaDoctor }).eq("id", patientId);
    const start = await getBillStart(desk.tenant!, { patient: patientId });
    expect(start.patient.phone).toBe("+919876543210");
    expect(start.doctor).toMatchObject({ id: mayaDoctor, feePaise: FEE });
    expect(start.doctors.map(({ id, feePaise }) => ({ id, feePaise }))).toEqual(
      expect.arrayContaining([
        { id: mayaDoctor, feePaise: FEE },
        { id: arunDoctor, feePaise: null },
      ]),
    );
    // A visit's or an arrival's bill keeps its own doctor: none to pick.
    const { appointmentId } = await arrived(patientId);
    expect((await getBillStart(desk.tenant!, { appointment: appointmentId })).doctors).toEqual([]);
  });

  it("starts on no one when their doctor no longer practises, who is not offered either", async () => {
    const patientId = await addPatient("Ira Sen");
    await admin().from("patients").update({ assigned_doctor_id: arunDoctor }).eq("id", patientId);
    await admin().from("doctors").update({ active: false }).eq("id", arunDoctor);
    try {
      const start = await getBillStart(desk.tenant!, { patient: patientId });
      expect(start.doctor).toBeNull();
      expect(start.doctors.map(({ id }) => id)).not.toContain(arunDoctor);
    } finally {
      await admin().from("doctors").update({ active: true }).eq("id", arunDoctor);
    }
  });

  it("issues the bill with the doctor picked, a Consultation at their fee — and at the price list's with none", async () => {
    const patientId = await addPatient("Leela Nair");
    const mayas = await issueBill(
      desk.tenant!,
      aBill({ patientId, doctorId: mayaDoctor, lines: [consultationLine("800")] }),
      randomUUID(),
    );
    const none = await issueBill(desk.tenant!, aBill({ patientId, lines: [consultationLine("500")] }), randomUUID());
    const { data: bills } = await admin()
      .from("bills")
      .select("id, doctor_id, total_paise")
      .in("id", [mayas.billId, none.billId]);
    expect(bills).toEqual(
      expect.arrayContaining([
        { id: mayas.billId, doctor_id: mayaDoctor, total_paise: FEE },
        { id: none.billId, doctor_id: null, total_paise: 50_000 },
      ]),
    );
    // Without payments.discount, no one's fee but the doctor's own (D284, D289).
    await expect(
      issueBill(desk.tenant!, aBill({ patientId, lines: [consultationLine("800")] }), randomUUID()),
    ).rejects.toMatchObject({ code: "BILL_PRICE_NOT_ALLOWED" });
  });
});
