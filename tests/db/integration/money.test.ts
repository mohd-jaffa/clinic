import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET as billPageRoute } from "@/app/api/bills/[id]/route";
import { GET as billPdfRoute } from "@/app/api/bills/[id]/bill.pdf/route";
import { POST as voidBillRoute } from "@/app/api/bills/[id]/void/route";
import { GET as billsRoute, POST as issueRoute } from "@/app/api/bills/route";
import { GET as outstandingRoute } from "@/app/api/outstanding/route";
import { POST as voidPaymentRoute } from "@/app/api/payments/[id]/void/route";
import { GET as paymentsRoute, POST as paymentRoute } from "@/app/api/payments/route";
import { GET as toBillRoute } from "@/app/api/to-bill/route";
import { POST as noChargeRoute } from "@/app/api/visits/[id]/no-charge/route";
import type { Permission } from "@/constants/permissions";
import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { getBill, issueBill, voidBill } from "@/features/billing/api";
import { getPatientBalance, listOutstanding, recordPayment, voidPayment } from "@/features/billing/payments";
import { listPatients } from "@/features/patients/api";
import { IDEMPOTENCY_HEADER } from "@/lib/api/client";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { sumPaise } from "@/lib/money";
import { billSchema, paymentSchema, walkInSchema } from "@/lib/validation";
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
 * Money that must be right (plan §15.2 – §15.4, §7.2; R8.7), through the
 * routes the browser calls and the feature functions, against the local
 * database: a double tap — Issue bill, Issue and collect, Record payment, a
 * refund, a void — makes one of each, numbered and counted once; a
 * patient's balance stays their issued bills less what they paid plus what
 * was refunded, to the paisa, wherever it is read, through discounts, odd
 * paise, voids and refunds; and a view-only clinic is refused every money
 * write, changing nothing, while it still reads and prints.
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

let clinic: TestClinic;
let desk: Member;
let doctorId: string;
let consultationType: string;
let consultation: string;

const today = todayKey();

async function addPatient(name: string, as: SignedIn = desk) {
  const { data, error } = await as
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  return data.patient_id;
}

/** A walk-in seen and done: the visit waiting in To bill. */
async function seen(patientId: string, as: SignedIn = desk) {
  const arrival = await addWalkIn(
    as.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultationType }),
    randomUUID(),
  );
  const { visitId } = await sendIn(as.tenant!, { appointmentId: arrival.id, others: "KEEP" });
  await markDone(as.tenant!, { appointmentId: arrival.id });
  return visitId;
}

/** A bill as New bill sends it: one Consultation at ₹800 unless said, nothing collected. */
const aBillBody = (input: Record<string, unknown>) => ({
  visitId: null,
  appointmentId: null,
  lines: [{ kind: "SERVICE", serviceId: consultation, treatmentId: null, quantity: 1, price: "800" }],
  discount: { kind: "NONE" },
  notes: "",
  collect: { on: false },
  ...input,
});

/** A payment as Record payment sends it: today, in cash, unless said. */
const aPaymentBody = (input: Record<string, unknown>) => ({
  kind: "PAYMENT",
  paidOn: today,
  method: "CASH",
  reference: "",
  note: "",
  ...input,
});

type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;

/** A route, asked as the member's browser asks it: their token, a body as JSON, an Idempotency-Key when given. */
async function call(
  handler: Handler,
  member: SignedIn,
  path: string,
  { method = "GET", body, key, id = "" }: { method?: string; body?: unknown; key?: string; id?: string } = {},
) {
  const headers: Record<string, string> = { authorization: `Bearer ${member.session.accessToken}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (key) headers[IDEMPOTENCY_HEADER] = key;
  const request = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve({ id }) });
  const type = response.headers.get("content-type") ?? "";
  return { status: response.status, type, body: type.includes("json") ? await response.json() : null };
}

const countOf = async (table: string, column: string, value: string) => {
  const { count, error } = await admin().from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (error) throw error;
  return count;
};
const balanceOf = async (patientId: string) =>
  (await admin().from("patient_balances").select("balance_paise").eq("patient_id", patientId).maybeSingle()).data
    ?.balance_paise ?? 0;

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  const maya = await addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view"] });
  desk = await addMember(clinic.clinicId, { permissions: DESK });
  const [{ data: doctor }, { data: type }, { data: service }] = await Promise.all([
    admin()
      .from("doctors")
      .update({ consultation_fee_paise: null })
      .eq("member_id", maya.memberId)
      .select("id")
      .single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
    admin()
      .from("services")
      .update({ price_paise: 80_000 })
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .select("id")
      .single(),
  ]);
  doctorId = doctor!.id as string;
  consultationType = type!.id as string;
  consultation = service!.id as string;
});

afterAll(removeAll);

describe("a double tap (plan §15.2, §15.3; R8.7)", () => {
  it("issues one bill of Issue bill sent twice at once under one key: one number, billed once, audited once", async () => {
    const patientId = await addPatient("Rohan Mehta");
    const visitId = await seen(patientId);
    const key = randomUUID();
    const body = aBillBody({ patientId, visitId });
    const [first, second] = await Promise.all(
      [0, 1].map(() => call(issueRoute, desk, "/api/bills", { method: "POST", body, key })),
    );
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(second.body.data.billId).toBe(first.body.data.billId);
    expect(second.body.data.number).toBe(first.body.data.number);
    expect(await countOf("bills", "patient_id", patientId)).toBe(1);
    expect(await countOf("audit_logs", "entity_id", first.body.data.billId)).toBe(1);
    expect(await balanceOf(patientId)).toBe(80_000);
    const { data: visit } = await admin().from("visits").select("billing_status").eq("id", visitId).single();
    expect(visit).toEqual({ billing_status: "BILLED" });

    // Another key is another bill.
    const again = await call(issueRoute, desk, "/api/bills", { method: "POST", body, key: randomUUID() });
    expect(again.body.data.billId).not.toBe(first.body.data.billId);
    expect(await balanceOf(patientId)).toBe(160_000);
  });

  it("issues one bill and one payment of Issue and collect sent twice at once (D282)", async () => {
    const patientId = await addPatient("Meera Pillai");
    const body = aBillBody({ patientId, collect: { on: true, amount: "800", method: "UPI", reference: "UTR 1" } });
    const key = randomUUID();
    const answers = await Promise.all(
      [0, 1].map(() => call(issueRoute, desk, "/api/bills", { method: "POST", body, key })),
    );
    expect(answers.map(({ status }) => status)).toEqual([201, 201]);
    expect(await countOf("bills", "patient_id", patientId)).toBe(1);
    expect(await countOf("payments", "patient_id", patientId)).toBe(1);
    expect(await balanceOf(patientId)).toBe(0);
  });

  it("records one payment of Record payment sent twice at once, and one refund of a refund sent twice", async () => {
    const patientId = await addPatient("Kiran Das");
    await issueBill(desk.tenant!, billSchema.parse(aBillBody({ patientId })), randomUUID());
    const paying = { method: "POST", body: aPaymentBody({ patientId, amount: "1,000" }), key: randomUUID() };
    const paid = await Promise.all([0, 1].map(() => call(paymentRoute, desk, "/api/payments", paying)));
    expect(paid.map(({ status }) => status)).toEqual([201, 201]);
    expect(paid[1].body.data.paymentId).toBe(paid[0].body.data.paymentId);
    expect(paid.map(({ body }) => body.data.balancePaise)).toEqual([-20_000, -20_000]);
    expect(await countOf("audit_logs", "entity_id", paid[0].body.data.paymentId)).toBe(1);

    // The owner hands back the ₹200 advance, the refund sent twice.
    const refunding = {
      method: "POST",
      body: aPaymentBody({ patientId, kind: "REFUND", amount: "200" }),
      key: randomUUID(),
    };
    const refunded = await Promise.all([0, 1].map(() => call(paymentRoute, clinic.owner, "/api/payments", refunding)));
    expect(refunded[1].body.data.paymentId).toBe(refunded[0].body.data.paymentId);
    expect(await countOf("payments", "patient_id", patientId)).toBe(2);
    expect(await balanceOf(patientId)).toBe(0);
  });

  it("voids once a payment or a bill voided twice at once, audited once, the balance moved once", async () => {
    const patientId = await addPatient("Sunil Nair");
    const { billId } = await issueBill(desk.tenant!, billSchema.parse(aBillBody({ patientId })), randomUUID());
    const { paymentId } = await recordPayment(
      desk.tenant!,
      paymentSchema.parse(aPaymentBody({ patientId, amount: "300" })),
      randomUUID(),
    );
    const voiding = { method: "POST", body: { reason: "Entered twice" } };
    const payment = await Promise.all(
      [0, 1].map(() =>
        call(voidPaymentRoute, clinic.owner, `/api/payments/${paymentId}/void`, { ...voiding, id: paymentId }),
      ),
    );
    expect(payment.map(({ status }) => status)).toEqual([200, 200]);
    expect(await countOf("audit_logs", "entity_id", paymentId)).toBe(2);
    expect(await balanceOf(patientId)).toBe(80_000);

    const bill = await Promise.all(
      [0, 1].map(() => call(voidBillRoute, clinic.owner, `/api/bills/${billId}/void`, { ...voiding, id: billId })),
    );
    expect(bill.map(({ status }) => status)).toEqual([200, 200]);
    // The bill's issue and its void.
    expect(await countOf("audit_logs", "entity_id", billId)).toBe(2);
    expect(await balanceOf(patientId)).toBe(0);
  });

  it("refuses a bill or a payment sent with no key, rather than risk two", async () => {
    const patientId = await addPatient("Anu Varma");
    const bill = await call(issueRoute, desk, "/api/bills", { method: "POST", body: aBillBody({ patientId }) });
    const paid = await call(paymentRoute, desk, "/api/payments", {
      method: "POST",
      body: aPaymentBody({ patientId, amount: "100" }),
    });
    for (const answer of [bill, paid]) {
      expect(answer.status).toBe(400);
      expect(answer.body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    }
    expect(await countOf("bills", "patient_id", patientId)).toBe(0);
  });
});

describe("a balance to the paisa (plan §15.4; D295, D298; R8.7)", () => {
  it("stays the issued bills less what was paid plus what was refunded, wherever it is read, step by step", async () => {
    const name = "Tara Iyer";
    const patientId = await addPatient(name);
    const { owner } = clinic;

    /** Every reader of the balance agrees with the rows, and the bills' settlement with the balance. */
    async function check(step: string) {
      const [{ data: bills }, { data: payments }] = await Promise.all([
        admin().from("bills").select("id, total_paise, status").eq("patient_id", patientId),
        admin().from("payments").select("kind, amount_paise, status").eq("patient_id", patientId),
      ]);
      const issued = bills!.filter((bill) => bill.status === "ISSUED");
      const recorded = payments!.filter((payment) => payment.status === "RECORDED");
      const billed = sumPaise(issued.map((bill) => bill.total_paise));
      const paid = sumPaise(recorded.filter((one) => one.kind === "PAYMENT").map((one) => one.amount_paise));
      const refunded = sumPaise(recorded.filter((one) => one.kind === "REFUND").map((one) => one.amount_paise));
      const expected = billed - paid + refunded;

      expect(await balanceOf(patientId), step).toBe(expected);
      expect(await getPatientBalance(desk.tenant!, patientId), step).toBe(expected);
      const listed = (await listPatients(desk.tenant!, { search: name, tab: "ALL" })).items.find(
        (patient) => patient.id === patientId,
      );
      expect(listed?.balancePaise, step).toBe(expected);
      const owing = (await listOutstanding(desk.tenant!, {})).items.find((one) => one.patient.id === patientId);
      expect(owing?.balancePaise ?? 0, step).toBe(Math.max(expected, 0));
      for (const bill of bills!) {
        expect((await getBill(desk.tenant!, bill.id)).balancePaise, step).toBe(expected);
      }

      // What the bills hold settles oldest first: as much as was paid net, never more than was billed (D298).
      const { data: settlement } = await admin()
        .from("bill_settlement")
        .select("bill_id, total_paise, paid_paise, due_paise")
        .eq("patient_id", patientId);
      expect(settlement!.map((row) => row.bill_id).sort(), step).toEqual(issued.map((bill) => bill.id).sort());
      const settled = sumPaise(settlement!.map((row) => Number(row.paid_paise)));
      expect(settled, step).toBe(Math.min(Math.max(paid - refunded, 0), billed));
      expect(sumPaise(settlement!.map((row) => Number(row.due_paise))), step).toBe(billed - settled);
      for (const row of settlement!) {
        expect(Number(row.paid_paise) + Number(row.due_paise), step).toBe(row.total_paise);
        expect(Number(row.due_paise), step).toBeGreaterThanOrEqual(0);
      }
    }

    // ₹333.33 three times at 7% off — to the nearest rupee (D290): ₹999.99 less ₹70.
    const first = await issueBill(
      owner.tenant,
      billSchema.parse(
        aBillBody({
          patientId,
          lines: [{ kind: "SERVICE", serviceId: consultation, treatmentId: null, quantity: 3, price: "333.33" }],
          discount: { kind: "PERCENT", percent: "7" },
        }),
      ),
      randomUUID(),
    );
    await check("a bill with a percentage off");
    expect(await balanceOf(patientId)).toBe(99_999 - 7_000);

    // ₹1,250.50 less ₹50.25.
    const second = await issueBill(
      owner.tenant,
      billSchema.parse(
        aBillBody({
          patientId,
          lines: [{ kind: "SERVICE", serviceId: consultation, treatmentId: null, quantity: 1, price: "1,250.50" }],
          discount: { kind: "AMOUNT", amount: "50.25" },
        }),
      ),
      randomUUID(),
    );
    await check("a bill with an amount off");

    const upi = await recordPayment(
      desk.tenant!,
      paymentSchema.parse(aPaymentBody({ patientId, amount: "500.75", method: "UPI" })),
      randomUUID(),
    );
    await check("part paid");
    await recordPayment(
      desk.tenant!,
      paymentSchema.parse(aPaymentBody({ patientId, amount: "1,000.10" })),
      randomUUID(),
    );
    await check("paid on");

    await voidBill(owner.tenant, second.billId, { reason: "Wrong lines" });
    await check("the second bill voided: an advance");
    expect(await balanceOf(patientId)).toBeLessThan(0);

    const advance = -(await balanceOf(patientId));
    await recordPayment(
      owner.tenant,
      paymentSchema.parse(aPaymentBody({ patientId, kind: "REFUND", amount: "123.45" })),
      randomUUID(),
    );
    await check("part of the advance refunded");
    expect(-(await balanceOf(patientId))).toBe(advance - 12_345);

    // The ₹500.75 voided: the ₹1,000.10 still covers the refund, so it may be (D301).
    await voidPayment(owner.tenant, upi.paymentId, { reason: "Bounced" });
    await check("a payment voided");

    // ₹1,000.10 paid less ₹123.45 back is ₹876.65 against the first bill's ₹929.99: Part paid, ₹53.34 due.
    await issueBill(desk.tenant!, billSchema.parse(aBillBody({ patientId })), randomUUID());
    await check("a later bill");
    expect((await getBill(desk.tenant!, first.billId)).settlement).toEqual({
      paidPaise: 87_665,
      duePaise: 5_334,
      state: "PART_PAID",
    });
    expect(await balanceOf(patientId)).toBe(5_334 + 80_000);
  });
});

describe("a view-only clinic's money (plan §7.2; R8.7)", () => {
  let lapsed: TestClinic;
  let patientId: string;
  let visitId: string;
  let billId: string;
  let paymentId: string;

  beforeAll(async () => {
    lapsed = await registerClinic({ fullName: "Kavya Menon" });
    const { owner } = lapsed;
    const doctor = await addMember(lapsed.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view"] });
    const [{ data: hers }, { data: type }, { data: service }] = await Promise.all([
      admin().from("doctors").select("id").eq("member_id", doctor.memberId).single(),
      admin()
        .from("appointment_types")
        .select("id")
        .eq("clinic_id", lapsed.clinicId)
        .eq("name", "Consultation")
        .single(),
      admin()
        .from("services")
        .update({ price_paise: 50_000 })
        .eq("clinic_id", lapsed.clinicId)
        .eq("name", "Consultation")
        .select("id")
        .single(),
    ]);
    patientId = await addPatient("Nila Das", owner);
    const arrival = await addWalkIn(
      owner.tenant,
      walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId: hers!.id, typeId: type!.id }),
      randomUUID(),
    );
    visitId = (await sendIn(owner.tenant, { appointmentId: arrival.id, others: "KEEP" })).visitId;
    await markDone(owner.tenant, { appointmentId: arrival.id });
    const line = [{ kind: "SERVICE", serviceId: service!.id, treatmentId: null, quantity: 1, price: "500" }];
    ({ billId } = await issueBill(owner.tenant, billSchema.parse(aBillBody({ patientId, lines: line })), randomUUID()));
    ({ paymentId } = await recordPayment(
      owner.tenant,
      paymentSchema.parse(aPaymentBody({ patientId, amount: "700" })),
      randomUUID(),
    ));
    // A second visit, done and waiting in To bill.
    const later = await addWalkIn(
      owner.tenant,
      walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId: hers!.id, typeId: type!.id }),
      randomUUID(),
    );
    visitId = (await sendIn(owner.tenant, { appointmentId: later.id, others: "KEEP" })).visitId;
    await markDone(owner.tenant, { appointmentId: later.id });
    await setValidUntil(lapsed.clinicId, addDaysKey(todayKey(), -PLATFORM_SETTING_DEFAULTS.graceDays - 30));
  });

  it("refuses every money write through its route with CLINIC_PLAN_EXPIRED, changing nothing", async () => {
    const { owner } = lapsed;
    const before = { bills: await countOf("bills", "patient_id", patientId), balance: await balanceOf(patientId) };
    const writes = await Promise.all([
      call(issueRoute, owner, "/api/bills", { method: "POST", body: aBillBody({ patientId }), key: randomUUID() }),
      call(paymentRoute, owner, "/api/payments", {
        method: "POST",
        body: aPaymentBody({ patientId, amount: "100" }),
        key: randomUUID(),
      }),
      call(paymentRoute, owner, "/api/payments", {
        method: "POST",
        body: aPaymentBody({ patientId, kind: "REFUND", amount: "100" }),
        key: randomUUID(),
      }),
      call(voidPaymentRoute, owner, `/api/payments/${paymentId}/void`, {
        method: "POST",
        body: { reason: "Entered twice" },
        id: paymentId,
      }),
      call(voidBillRoute, owner, `/api/bills/${billId}/void`, {
        method: "POST",
        body: { reason: "Twice" },
        id: billId,
      }),
      call(noChargeRoute, owner, `/api/visits/${visitId}/no-charge`, {
        method: "POST",
        body: { reason: "REVIEW", note: "" },
        id: visitId,
      }),
    ]);
    for (const write of writes) {
      expect(write.status).toBe(422);
      expect(write.body.error.code).toBe("CLINIC_PLAN_EXPIRED");
    }
    expect(await countOf("bills", "patient_id", patientId)).toBe(before.bills);
    expect(await countOf("payments", "patient_id", patientId)).toBe(1);
    expect(await balanceOf(patientId)).toBe(before.balance);
    const [{ data: bill }, { data: payment }, { data: visit }] = await Promise.all([
      admin().from("bills").select("status").eq("id", billId).single(),
      admin().from("payments").select("status").eq("id", paymentId).single(),
      admin().from("visits").select("billing_status").eq("id", visitId).single(),
    ]);
    expect([bill!.status, payment!.status, visit!.billing_status]).toEqual(["ISSUED", "RECORDED", "TO_BILL"]);
  });

  it("refuses the money tables written straight through the database's API", async () => {
    const { supabase } = lapsed.owner.tenant;
    const { error: inserted } = await supabase.from("payments").insert({
      clinic_id: lapsed.clinicId,
      patient_id: patientId,
      kind: "PAYMENT",
      amount_paise: 100,
      method: "CASH",
      idempotency_key: randomUUID(),
    });
    expect(inserted).not.toBeNull();
    const { data: changed } = await supabase
      .from("patient_balances")
      .update({ paid_paise: 0 })
      .eq("patient_id", patientId)
      .select("patient_id");
    expect(changed ?? []).toEqual([]);
    expect(await balanceOf(patientId)).toBe(-20_000);
  });

  it("still reads its money and prints its bills", async () => {
    const { owner } = lapsed;
    const reads = await Promise.all([
      call(billsRoute, owner, `/api/bills?from=${today}&to=${today}`),
      call(paymentsRoute, owner, `/api/payments?from=${today}&to=${today}`),
      call(outstandingRoute, owner, "/api/outstanding"),
      call(toBillRoute, owner, "/api/to-bill"),
      call(billPageRoute, owner, `/api/bills/${billId}`, { id: billId }),
    ]);
    expect(reads.map(({ status }) => status)).toEqual([200, 200, 200, 200, 200]);
    expect(reads[0].body.data.items.map((bill: { id: string }) => bill.id)).toContain(billId);
    expect(reads[3].body.data.items.map((visit: { visitId: string }) => visit.visitId)).toContain(visitId);
    const pdf = await call(billPdfRoute, owner, `/api/bills/${billId}/bill.pdf`, { id: billId });
    expect(pdf).toMatchObject({ status: 200, type: "application/pdf" });
  });
});
