import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { archivePatient } from "@/features/patients/api";
import { addDaysKey, dayTime, todayKey } from "@/lib/dates/calendar";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Payments and balances in the database (plan §15.3, §15.4; R8.4, D282,
 * D295 – D301): a payment against the patient, once per key, received by
 * whoever took it, paid now or before on the clinic's day; an advance used
 * by later bills; a refund of no more than the advance, with payments.edit;
 * a void, once, a payment with a refund standing on it only after the
 * refund; a payment collected with its bill in one transaction; bills
 * settled oldest first; every balance equal to its bills and payments; an
 * archived patient read-only, their balance kept.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = ["patients.view", "patients.create", "patients.edit", "payments.view", "payments.create"];

let clinic: TestClinic;
let desk: Member;
let consultation: string;
const today = todayKey();
const FEE = 50_000;

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

interface Answer {
  payment_id: string;
  created: boolean;
  balance_paise: number;
}

/** A payment (or, with `kind`, a refund) through record_payment, as `who`. */
const record = (who: SignedIn, payment: Record<string, unknown>, key: string | null = randomUUID()) =>
  who.tenant!.supabase.rpc("record_payment", { p_payment: { method: "CASH", ...payment }, p_idempotency_key: key });

async function recorded(who: SignedIn, payment: Record<string, unknown>, key: string = randomUUID()) {
  const { data, error } = await record(who, payment, key);
  if (error) throw error;
  return data as Answer;
}

/** A bill of Consultations at the price list's, as the desk issues it, with what is collected. */
const issue = (patientId: string, count = 1, payment?: Record<string, unknown>, key: string = randomUUID()) =>
  desk.tenant!.supabase.rpc("create_bill", {
    p_bill: {
      patient_id: patientId,
      items: [{ service_id: consultation, quantity: count, unit_price_paise: FEE }],
      subtotal_paise: count * FEE,
      total_paise: count * FEE,
      ...(payment ? { payment } : {}),
    },
    p_idempotency_key: key,
  });

async function billed(patientId: string, count = 1) {
  const { data, error } = await issue(patientId, count);
  if (error) throw error;
  return data as { bill_id: string; balance_paise: number };
}

const voidPayment = (who: SignedIn, id: string, reason: string | null = "Entered twice") =>
  who.tenant!.supabase.rpc("void_payment", { p_payment_id: id, p_reason: reason });

const balanceOf = async (patientId: string) =>
  (
    await admin()
      .from("patient_balances")
      .select("billed_paise, paid_paise, refunded_paise, balance_paise")
      .eq("patient_id", patientId)
      .maybeSingle()
  ).data;

const paymentOf = async (id: string) => (await admin().from("payments").select("*").eq("id", id).single()).data!;

/** A patient's bills as Billing will read them: paid, due and state, oldest first. */
const settlementOf = async (patientId: string) =>
  (
    await clinic.owner.tenant.supabase
      .from("bill_settlement")
      .select("total_paise, paid_paise, due_paise, state")
      .eq("patient_id", patientId)
      .order("issued_at")
  ).data;

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  desk = await addMember(clinic.clinicId, { permissions: DESK });
  const { data } = await admin()
    .from("services")
    .update({ price_paise: FEE })
    .eq("clinic_id", clinic.clinicId)
    .eq("name", "Consultation")
    .select("id")
    .single();
  consultation = data!.id as string;
});

afterAll(removeAll);

describe("recording a payment (plan §15.3)", () => {
  it("is against the patient, once per idempotency key, received by whoever took it", async () => {
    const patientId = await addPatient("Rohan Mehta");
    await billed(patientId);
    expect(await balanceOf(patientId)).toEqual({
      billed_paise: FEE,
      paid_paise: 0,
      refunded_paise: 0,
      balance_paise: FEE,
    });

    const key = randomUUID();
    const paid = await recorded(
      desk,
      { patient_id: patientId, amount_paise: 30_000, method: "UPI", reference: "UPI 4471", note: "Paid by her son" },
      key,
    );
    expect(paid).toMatchObject({ created: true, balance_paise: 20_000 });
    expect(await paymentOf(paid.payment_id)).toMatchObject({
      patient_id: patientId,
      kind: "PAYMENT",
      amount_paise: 30_000,
      method: "UPI",
      reference: "UPI 4471",
      note: "Paid by her son",
      paid_on: today,
      status: "RECORDED",
      received_by: desk.userId,
    });

    // Tapped twice: the same payment, the balance as it was.
    expect(await recorded(desk, { patient_id: patientId, amount_paise: 30_000 }, key)).toEqual({
      payment_id: paid.payment_id,
      created: false,
      balance_paise: 20_000,
    });
    expect((await balanceOf(patientId))!.paid_paise).toBe(30_000);
  });

  it("takes more than is owed as an advance, which later bills use", async () => {
    const patientId = await addPatient("Kiran Shah");
    expect((await recorded(desk, { patient_id: patientId, amount_paise: 100_000 })).balance_paise).toBe(-100_000);
    expect((await billed(patientId)).balance_paise).toBe(-50_000);
    expect(await settlementOf(patientId)).toEqual([{ total_paise: FEE, paid_paise: FEE, due_paise: 0, state: "PAID" }]);
  });

  it("is paid now or earlier, never later, and counts on the clinic's day (D299)", async () => {
    const patientId = await addPatient("Meera Iyer");
    const earlier = dayTime(addDaysKey(today, -2), "18:30");
    const before = await recorded(desk, { patient_id: patientId, amount_paise: 1_000, paid_at: earlier });
    expect(await paymentOf(before.payment_id)).toMatchObject({ paid_on: addDaysKey(today, -2) });

    // 1:30 AM in India is still the day before in UTC: it counts on India's day.
    // Yesterday's, so it is never later than now, whenever this runs.
    const yesterday = addDaysKey(today, -1);
    const early = dayTime(yesterday, "01:30");
    expect(new Date(early).getUTCDate()).not.toBe(Number(yesterday.slice(8)));
    const night = await recorded(desk, { patient_id: patientId, amount_paise: 1_000, paid_at: early });
    expect(await paymentOf(night.payment_id)).toMatchObject({ paid_on: yesterday });

    const later = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect((await record(desk, { patient_id: patientId, amount_paise: 1_000, paid_at: later })).error?.hint).toBe(
      "VALIDATION_ERROR",
    );
  });

  it("refuses an amount of nothing or past the largest, a method not the app's, and no key", async () => {
    const patientId = await addPatient("Anil Kumar");
    for (const payment of [
      { patient_id: patientId, amount_paise: 0 },
      { patient_id: patientId, amount_paise: 100_000_001 },
      { patient_id: patientId, amount_paise: 1_000, method: "CHEQUE" },
    ]) {
      expect((await record(desk, payment)).error?.code, JSON.stringify(payment)).toBe("23514");
    }
    expect((await record(desk, { patient_id: randomUUID(), amount_paise: 1_000 })).error?.hint).toBe(
      "RECORD_NOT_FOUND",
    );
    expect((await record(desk, { patient_id: patientId, amount_paise: 1_000 }, null)).error?.hint).toBe(
      "IDEMPOTENCY_KEY_REQUIRED",
    );
    expect(await balanceOf(patientId)).toBeNull();
  });
});

describe("refunds and voids (plan §15.3; D297, D301)", () => {
  it("refunds no more than the advance held, with payments.edit", async () => {
    const patientId = await addPatient("Divya Nair");
    const paid = await recorded(desk, { patient_id: patientId, amount_paise: 100_000 });
    await billed(patientId); // ₹500 billed; ₹500 held in advance.

    const refund = { patient_id: patientId, kind: "REFUND", amount_paise: 50_000, method: "UPI" };
    expect((await record(desk, refund)).error?.hint).toBe("AUTH_PERMISSION_DENIED");
    expect((await record(clinic.owner, { ...refund, amount_paise: 50_001 })).error?.hint).toBe(
      "PAYMENT_REFUND_TOO_LARGE",
    );
    const handed = await recorded(clinic.owner, refund);
    expect(handed.balance_paise).toBe(0);
    expect(await paymentOf(handed.payment_id)).toMatchObject({ kind: "REFUND", received_by: clinic.owner.userId });
    expect((await record(clinic.owner, { ...refund, amount_paise: 1 })).error?.hint).toBe("PAYMENT_REFUND_TOO_LARGE");

    // A payment with that refund standing on it is voided only after the refund (D301).
    expect((await voidPayment(clinic.owner, paid.payment_id)).error?.hint).toBe("PAYMENT_HAS_REFUNDS");
    expect((await voidPayment(clinic.owner, handed.payment_id, "Handed back by mistake")).data).toEqual({
      previously: "RECORDED",
      kind: "REFUND",
      amount_paise: 50_000,
      balance_paise: -50_000,
    });
    expect((await voidPayment(clinic.owner, paid.payment_id)).data).toMatchObject({
      previously: "RECORDED",
      balance_paise: FEE,
    });
    expect(await balanceOf(patientId)).toEqual({
      billed_paise: FEE,
      paid_paise: 0,
      refunded_paise: 0,
      balance_paise: FEE,
    });
  });

  it("voids with payments.edit and a reason, once, stamped with who and when, never edited", async () => {
    const patientId = await addPatient("Farah Khan");
    const paid = await recorded(desk, { patient_id: patientId, amount_paise: 20_000 });
    expect((await voidPayment(desk, paid.payment_id)).error?.hint).toBe("AUTH_PERMISSION_DENIED");
    expect((await voidPayment(clinic.owner, paid.payment_id, null)).error?.hint).toBe("VALIDATION_ERROR");
    await voidPayment(clinic.owner, paid.payment_id, "Wrong patient");
    const voided = await paymentOf(paid.payment_id);
    expect(voided).toMatchObject({ status: "VOID", void_reason: "Wrong patient", voided_by: clinic.owner.userId });
    expect(voided.voided_at).not.toBeNull();
    expect((await voidPayment(clinic.owner, paid.payment_id, "Again")).data).toMatchObject({
      previously: "VOID",
      balance_paise: 0,
    });

    const { error: edited } = await admin().from("payments").update({ amount_paise: 1 }).eq("id", paid.payment_id);
    expect(edited?.hint).toBe("VALIDATION_ERROR");
    expect((await voidPayment(clinic.owner, randomUUID())).error?.hint).toBe("RECORD_NOT_FOUND");
  });
});

describe("collecting with a bill (D282)", () => {
  it("records the payment in the bill's transaction, once per key", async () => {
    const patientId = await addPatient("Gita Rao");
    const key = randomUUID();
    const { data, error } = await issue(patientId, 1, { amount_paise: FEE, method: "CASH" }, key);
    expect(error).toBeNull();
    const made = data as { bill_id: string; payment_id: string; created: boolean; balance_paise: number };
    expect(made).toMatchObject({ created: true, balance_paise: 0 });
    expect(await paymentOf(made.payment_id)).toMatchObject({
      kind: "PAYMENT",
      amount_paise: FEE,
      method: "CASH",
      paid_on: today,
      received_by: desk.userId,
      idempotency_key: key,
    });

    const again = await issue(patientId, 1, { amount_paise: FEE, method: "CASH" }, key);
    expect(again.data).toMatchObject({
      bill_id: made.bill_id,
      payment_id: made.payment_id,
      created: false,
      balance_paise: 0,
    });
    const { count } = await admin()
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId);
    expect(count).toBe(1);
  });

  it("keeps more than the bill as an advance, issues without a payment, and issues nothing when the payment is refused", async () => {
    const patientId = await addPatient("Hari Menon");
    const over = await issue(patientId, 1, { amount_paise: 80_000, method: "UPI", reference: "UPI 99" });
    expect((over.data as { balance_paise: number }).balance_paise).toBe(-30_000);
    const unpaid = await issue(patientId);
    expect(unpaid.data).toMatchObject({ payment_id: null, balance_paise: 20_000 });

    const key = randomUUID();
    const refused = await issue(patientId, 1, { amount_paise: 0, method: "CASH" }, key);
    expect(refused.error?.code).toBe("23514");
    const { count } = await admin()
      .from("bills")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", key);
    expect(count).toBe(0);
    expect((await balanceOf(patientId))!.balance_paise).toBe(20_000);
  });
});

describe("each bill's paid and due (plan §15.2, D298)", () => {
  it("settles bills oldest first, and follows voids and refunds", async () => {
    const patientId = await addPatient("Isha Pillai");
    const first = await billed(patientId, 2); // ₹1,000
    await billed(patientId); // ₹500
    expect(await settlementOf(patientId)).toEqual([
      { total_paise: 100_000, paid_paise: 0, due_paise: 100_000, state: "UNPAID" },
      { total_paise: FEE, paid_paise: 0, due_paise: FEE, state: "UNPAID" },
    ]);

    await recorded(desk, { patient_id: patientId, amount_paise: 120_000 });
    expect(await settlementOf(patientId)).toEqual([
      { total_paise: 100_000, paid_paise: 100_000, due_paise: 0, state: "PAID" },
      { total_paise: FEE, paid_paise: 20_000, due_paise: 30_000, state: "PART_PAID" },
    ]);

    // The first voided, what was paid settles the second, and ₹700 is held in advance.
    await clinic.owner.tenant.supabase.rpc("void_bill", { p_bill_id: first.bill_id, p_reason: "Wrong patient" });
    expect(await settlementOf(patientId)).toEqual([{ total_paise: FEE, paid_paise: FEE, due_paise: 0, state: "PAID" }]);
    expect((await balanceOf(patientId))!.balance_paise).toBe(-70_000);

    await recorded(clinic.owner, { patient_id: patientId, kind: "REFUND", amount_paise: 70_000 });
    expect(await settlementOf(patientId)).toEqual([{ total_paise: FEE, paid_paise: FEE, due_paise: 0, state: "PAID" }]);
    expect((await balanceOf(patientId))!.balance_paise).toBe(0);
  });
});

describe("a patient's balance (plan §15.4, D295)", () => {
  it("is always their issued bills less their recorded payments plus refunds, to the paisa", async () => {
    const [{ data: patients }, { data: bills }, { data: payments }, { data: balances }] = await Promise.all([
      admin().from("patients").select("id").eq("clinic_id", clinic.clinicId),
      admin().from("bills").select("patient_id, total_paise").eq("clinic_id", clinic.clinicId).eq("status", "ISSUED"),
      admin()
        .from("payments")
        .select("patient_id, kind, amount_paise")
        .eq("clinic_id", clinic.clinicId)
        .eq("status", "RECORDED"),
      admin().from("patient_balances").select("patient_id, balance_paise").eq("clinic_id", clinic.clinicId),
    ]);
    expect(balances!.length).toBeGreaterThan(5);
    for (const { id } of patients!) {
      const billedTotal = bills!
        .filter((bill) => bill.patient_id === id)
        .reduce((sum, bill) => sum + bill.total_paise, 0);
      const moneyIn = payments!
        .filter((payment) => payment.patient_id === id)
        .reduce((sum, payment) => sum + (payment.kind === "PAYMENT" ? -1 : 1) * payment.amount_paise, 0);
      const kept = balances!.find((balance) => balance.patient_id === id)?.balance_paise ?? 0;
      expect(kept, id).toBe(billedTotal + moneyIn);
    }
  });

  it("stays when a patient who owes is archived, and takes nothing more until they are restored (D300)", async () => {
    const patientId = await addPatient("Jaya Rao");
    const paid = await recorded(desk, { patient_id: patientId, amount_paise: 10_000 });
    await billed(patientId);
    await archivePatient(desk.tenant!, patientId);
    expect((await balanceOf(patientId))!.balance_paise).toBe(40_000);
    expect((await record(desk, { patient_id: patientId, amount_paise: 40_000 })).error?.hint).toBe("PATIENT_ARCHIVED");
    expect((await voidPayment(clinic.owner, paid.payment_id)).error?.hint).toBe("PATIENT_ARCHIVED");
  });
});
