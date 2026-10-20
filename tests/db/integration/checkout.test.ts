import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { issueBill, listBills, voidBill } from "@/features/billing/api";
import { countToBill, listToBill, markNoCharge } from "@/features/billing/checkout";
import { listOutstanding, listPayments, recordPayment, voidPayment } from "@/features/billing/payments";
import { listPatients } from "@/features/patients/api";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { billSchema, noChargeSchema, paymentSchema, walkInSchema } from "@/lib/validation";
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
 * Checkout (plan §15.4, §15.6, §10.2; R8.6, D318 – D325, D334 – D338), from
 * the feature functions against the local database: the visits waiting in
 * To bill for reception, who may not open them — their doctor, token, the
 * treatments worked on and a fee paid at arrival — and how many; No charge;
 * Billing's bills by their days and state, as `bill_settlement` works them
 * out; payments recorded today or on an earlier day, voided, refunded; who
 * owes; and the patients list's Owing tab and balance — within the
 * permissions, the doctor scope, the clinic and its plan.
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
const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit", "payments.view"];

let clinic: TestClinic;
let other: TestClinic;
let desk: Member;
let maya: Member;
let arun: Member;
let looker: Member;
let mayaDoctor: string;
let arunDoctor: string;
let consultationType: string;
let consultation: string;

const today = todayKey();

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

/** A walk-in seen and done: the visit waiting in To bill, its arrival and token. */
async function seen(patientId: string, doctorId = mayaDoctor, treatment?: string) {
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultationType }),
    randomUUID(),
  );
  const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
  if (treatment) {
    const doctor = doctorId === mayaDoctor ? maya : arun;
    const { error } = await doctor.tenant!.supabase.rpc("create_treatment", {
      p_treatment: { name: treatment, status: "IN_PROGRESS" },
      p_visit_id: visitId,
    });
    if (error) throw error;
  }
  await markDone(desk.tenant!, { appointmentId: arrival.id });
  return { visitId, appointmentId: arrival.id, token: arrival.token };
}

const aBill = (input: Record<string, unknown>) =>
  billSchema.parse({
    visitId: null,
    appointmentId: null,
    discount: { kind: "NONE" },
    notes: "",
    collect: { on: false },
    lines: [{ kind: "SERVICE", serviceId: consultation, treatmentId: null, quantity: 1, price: "800" }],
    ...input,
  });

const aPayment = (input: Record<string, unknown>) =>
  paymentSchema.parse({
    kind: "PAYMENT",
    paidOn: today,
    method: "CASH",
    reference: "",
    note: "",
    ...input,
  });

beforeAll(async () => {
  [clinic, other] = await Promise.all([registerClinic({ fullName: "Asha Menon" }), registerClinic()]);
  [desk, maya, arun, looker] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view"] }),
  ]);
  const doctorOf = async (member: Member, name: string) => {
    await admin().from("profiles").update({ full_name: name }).eq("id", member.userId);
    return (
      await admin()
        .from("doctors")
        .update({ consultation_fee_paise: 80_000 })
        .eq("member_id", member.memberId)
        .select("id")
        .single()
    ).data!.id as string;
  };
  [mayaDoctor, arunDoctor] = await Promise.all([doctorOf(maya, "Maya Rao"), doctorOf(arun, "Arun Nair")]);
  const [{ data: type }, { data: seeded }] = await Promise.all([
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
    admin()
      .from("services")
      .update({ price_paise: 80_000 })
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .select("id")
      .single(),
  ]);
  consultationType = type!.id as string;
  consultation = seeded!.id as string;
});

afterAll(removeAll);

describe("To bill (plan §15.6; D318, D337)", () => {
  it("lists the visits waiting for reception, oldest first: doctor, token, the treatments worked on, a fee paid", async () => {
    const [rohan, meera] = await Promise.all([addPatient("Rohan Mehta"), addPatient("Meera Pillai")]);
    const first = await seen(rohan, mayaDoctor, "Root canal");
    // Meera's fee was paid at arrival; a treatment worked on keeps her in To bill (§15.6).
    const arrival = await addWalkIn(
      desk.tenant!,
      walkInSchema.parse({ patient: { mode: "FOUND", id: meera }, doctorId: arunDoctor, typeId: consultationType }),
      randomUUID(),
    );
    await issueBill(desk.tenant!, aBill({ patientId: meera, appointmentId: arrival.id }), randomUUID());
    const { visitId: second } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
    const { error } = await arun.tenant!.supabase.rpc("create_treatment", {
      p_treatment: { name: "Scaling", status: "IN_PROGRESS" },
      p_visit_id: second,
    });
    expect(error).toBeNull();
    await markDone(desk.tenant!, { appointmentId: arrival.id });

    const page = await listToBill(desk.tenant!, {});
    const ours = page.items.filter((visit) => [first.visitId, second].includes(visit.visitId));
    expect(ours).toEqual([
      {
        visitId: first.visitId,
        day: today,
        completedAt: expect.any(String),
        patient: { id: rohan, name: "Rohan Mehta", number: expect.any(Number), archived: false },
        doctor: { id: mayaDoctor, name: "Maya Rao" },
        appointmentId: first.appointmentId,
        token: first.token,
        treatments: ["Root canal"],
        feePaid: false,
      },
      expect.objectContaining({
        visitId: second,
        doctor: { id: arunDoctor, name: "Arun Nair" },
        treatments: ["Scaling"],
        feePaid: true,
      }),
    ]);

    // One doctor's; and how many wait, every doctor's or one's.
    const mayas = await listToBill(desk.tenant!, { doctorId: mayaDoctor });
    expect(mayas.items.every((visit) => visit.doctor!.id === mayaDoctor)).toBe(true);
    const [all, hers] = await Promise.all([
      countToBill(desk.tenant!, {}),
      countToBill(desk.tenant!, { doctorId: mayaDoctor }),
    ]);
    expect(all.count).toBe(page.items.length);
    expect(hers.count).toBe(mayas.items.length);
  });

  it("is a doctor's own patients for a doctor, the clinic's alone, and for whoever reads bills", async () => {
    const patient = await addPatient("Kabir Shah");
    const { visitId } = await seen(patient, arunDoctor);
    expect((await listToBill(arun.tenant!, {})).items.map((visit) => visit.visitId)).toContain(visitId);
    expect((await listToBill(maya.tenant!, {})).items.map((visit) => visit.visitId)).not.toContain(visitId);
    expect((await listToBill(other.owner.tenant, {})).items).toEqual([]);
    await expect(listToBill(looker.tenant!, {})).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    await expect(countToBill(looker.tenant!, {})).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("No charge (plan §15.6; D319)", () => {
  it("settles a visit free once, audited; a billed one is refused; a bill after makes it Billed (D287)", async () => {
    const patient = await addPatient("Isha Kapoor");
    const { visitId } = await seen(patient);
    expect(
      await markNoCharge(
        desk.tenant!,
        visitId,
        noChargeSchema.parse({ reason: "OTHER", note: "Staff family" }),
        "req_nc",
      ),
    ).toEqual({ visitId });
    const { data: visit } = await admin()
      .from("visits")
      .select("billing_status, no_charge_reason, no_charge_note")
      .eq("id", visitId)
      .single();
    expect(visit).toEqual({ billing_status: "NO_CHARGE", no_charge_reason: "OTHER", no_charge_note: "Staff family" });
    expect((await listToBill(desk.tenant!, {})).items.map((each) => each.visitId)).not.toContain(visitId);
    const { data: audit } = await admin().from("audit_logs").select("entity_type, changes").eq("request_id", "req_nc");
    expect(audit).toEqual([
      {
        entity_type: "visits",
        changes: {
          billing_status: { from: "TO_BILL", to: "NO_CHARGE" },
          no_charge_reason: { from: null, to: "OTHER" },
        },
      },
    ]);

    // Again, nothing more.
    await markNoCharge(desk.tenant!, visitId, noChargeSchema.parse({ reason: "REVIEW", note: "" }), "req_nc_again");
    const { count } = await admin()
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("request_id", "req_nc_again");
    expect(count).toBe(0);

    // Billed after all, it is Billed; and No charge is refused then.
    await issueBill(desk.tenant!, aBill({ patientId: patient, visitId }), randomUUID());
    await expect(
      markNoCharge(desk.tenant!, visitId, noChargeSchema.parse({ reason: "REVIEW", note: "" })),
    ).rejects.toMatchObject({ code: "VISIT_NOT_TO_BILL" });
    await expect(
      markNoCharge(looker.tenant!, visitId, noChargeSchema.parse({ reason: "REVIEW", note: "" })),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("Billing's bills (plan §15.4; D320)", () => {
  it("lists the bills of the days asked, newest first, each where it stands — as bill_settlement has it — or Void", async () => {
    const patient = await addPatient("Tara Iyer");
    // Three bills of ₹800 and ₹1,300 paid, oldest first (D298): the first Paid, the second Part paid, the third voided.
    const firstBill = await issueBill(desk.tenant!, aBill({ patientId: patient }), randomUUID());
    const secondBill = await issueBill(desk.tenant!, aBill({ patientId: patient }), randomUUID());
    const thirdBill = await issueBill(desk.tenant!, aBill({ patientId: patient }), randomUUID());
    await recordPayment(desk.tenant!, aPayment({ patientId: patient, amount: "1,300" }), randomUUID());
    await voidBill(clinic.owner.tenant, thirdBill.billId, { reason: "Twice" });

    const days = { from: today, to: today };
    const listed = (await listBills(desk.tenant!, days)).items.filter((bill) => bill.patient.id === patient);
    expect(listed.map((bill) => [bill.id, bill.state, bill.settlement])).toEqual([
      [thirdBill.billId, "VOID", null],
      [secondBill.billId, "PART_PAID", { paidPaise: 50_000, duePaise: 30_000 }],
      [firstBill.billId, "PAID", { paidPaise: 80_000, duePaise: 0 }],
    ]);
    const { data: settled } = await admin()
      .from("bill_settlement")
      .select("bill_id, paid_paise, state")
      .eq("patient_id", patient)
      .order("issued_at");
    expect(settled).toEqual([
      { bill_id: firstBill.billId, paid_paise: 80_000, state: "PAID" },
      { bill_id: secondBill.billId, paid_paise: 50_000, state: "PART_PAID" },
    ]);

    // Kept to a state; other days hold none of them.
    const partPaid = await listBills(desk.tenant!, { ...days, state: "PART_PAID" });
    expect(partPaid.items.every((bill) => bill.state === "PART_PAID")).toBe(true);
    expect(partPaid.items.map((bill) => bill.id)).toContain(secondBill.billId);
    const yesterday = addDaysKey(today, -1);
    const before = await listBills(desk.tenant!, { from: yesterday, to: yesterday });
    expect(before.items.map((bill) => bill.patient.id)).not.toContain(patient);
    expect((await listBills(other.owner.tenant, days)).items).toEqual([]);
  });
});

describe("Payments (plan §15.3, §15.4; D334, D336)", () => {
  it("records today's now and an earlier day's at its noon, counted on that day; audited once per key", async () => {
    const patient = await addPatient("Nikhil Rao");
    await issueBill(desk.tenant!, aBill({ patientId: patient }), randomUUID());
    const key = randomUUID();
    const earlier = addDaysKey(today, -3);
    const recorded = await recordPayment(
      desk.tenant!,
      aPayment({ patientId: patient, amount: "300", paidOn: earlier, method: "UPI", reference: "UTR 9" }),
      key,
      "req_pay",
    );
    expect(recorded.balancePaise).toBe(50_000);
    // Sent again: the same payment, nothing more recorded or audited.
    expect(
      await recordPayment(
        desk.tenant!,
        aPayment({ patientId: patient, amount: "300", paidOn: earlier }),
        key,
        "req_again",
      ),
    ).toEqual(recorded);
    const { data: row } = await admin()
      .from("payments")
      .select("paid_on, paid_at, received_by")
      .eq("id", recorded.paymentId)
      .single();
    expect(row!.paid_on).toBe(earlier);
    expect(new Date(row!.paid_at).toISOString()).toBe(new Date(`${earlier}T12:00:00+05:30`).toISOString());
    expect(row!.received_by).toBe(desk.userId);
    const { data: audit } = await admin()
      .from("audit_logs")
      .select("request_id, changes")
      .in("request_id", ["req_pay", "req_again"]);
    expect(audit).toEqual([
      {
        request_id: "req_pay",
        changes: {
          kind: { from: null, to: "PAYMENT" },
          amount_paise: { from: null, to: 30_000 },
          method: { from: null, to: "UPI" },
          paid_on: { from: null, to: earlier },
        },
      },
    ]);

    // On its own day in the Payments tab, not today's.
    const onTheDay = await listPayments(desk.tenant!, { from: earlier, to: earlier });
    expect(onTheDay.items.map((payment) => payment.id)).toContain(recorded.paymentId);
    expect(onTheDay.items.find((payment) => payment.id === recorded.paymentId)).toMatchObject({
      kind: "PAYMENT",
      amountPaise: 30_000,
      method: "UPI",
      reference: "UTR 9",
      receivedBy: expect.any(String),
      void: null,
    });
    expect((await listPayments(desk.tenant!, { from: today, to: today })).items.map((each) => each.id)).not.toContain(
      recorded.paymentId,
    );
  });

  it("refunds no more than the advance, for payments.edit; a payment is voided after its refund (D297, D301)", async () => {
    const patient = await addPatient("Leela Menon");
    const paid = await recordPayment(desk.tenant!, aPayment({ patientId: patient, amount: "1,000" }), randomUUID());
    expect(paid.balancePaise).toBe(-100_000);
    const refund = aPayment({ patientId: patient, kind: "REFUND", amount: "400" });
    await expect(recordPayment(desk.tenant!, refund, randomUUID())).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    await expect(
      recordPayment(
        clinic.owner.tenant,
        aPayment({ patientId: patient, kind: "REFUND", amount: "1,200" }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_REFUND_TOO_LARGE" });
    const refunded = await recordPayment(clinic.owner.tenant, refund, randomUUID());
    expect(refunded.balancePaise).toBe(-60_000);

    await expect(voidPayment(clinic.owner.tenant, paid.paymentId, { reason: "Wrong" })).rejects.toMatchObject({
      code: "PAYMENT_HAS_REFUNDS",
    });
    await expect(voidPayment(desk.tenant!, refunded.paymentId, { reason: "Typo" })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    expect(await voidPayment(clinic.owner.tenant, refunded.paymentId, { reason: "Typo" }, "req_vr")).toEqual({
      balancePaise: -100_000,
    });
    expect(await voidPayment(clinic.owner.tenant, paid.paymentId, { reason: "Wrong" }, "req_vp")).toEqual({
      balancePaise: 0,
    });
    // Again changes nothing, and audits nothing.
    await voidPayment(clinic.owner.tenant, paid.paymentId, { reason: "Again" }, "req_vp_again");
    const { data: audit } = await admin()
      .from("audit_logs")
      .select("request_id, changes")
      .in("request_id", ["req_vr", "req_vp", "req_vp_again"])
      .order("request_id");
    expect(audit).toEqual([
      {
        request_id: "req_vp",
        changes: { status: { from: "RECORDED", to: "VOID" }, void_reason: { from: null, to: "Wrong" } },
      },
      {
        request_id: "req_vr",
        changes: { status: { from: "RECORDED", to: "VOID" }, void_reason: { from: null, to: "Typo" } },
      },
    ]);
    const voided = (await listPayments(desk.tenant!, { from: today, to: today })).items.find(
      (payment) => payment.id === paid.paymentId,
    );
    expect(voided).toMatchObject({ status: "VOID", void: { reason: "Wrong", by: "Asha Menon" } });
  });

  it("refuses a view-only clinic, and reads another clinic's payments as none", async () => {
    expect((await listPayments(other.owner.tenant, { from: today, to: today })).items).toEqual([]);
    const patient = await addPatient("Omar Khan");
    await setValidUntil(clinic.clinicId, addDaysKey(today, -400));
    try {
      await expect(
        recordPayment(desk.tenant!, aPayment({ patientId: patient, amount: "100" }), randomUUID()),
      ).rejects.toMatchObject({ code: "CLINIC_PLAN_EXPIRED" });
    } finally {
      await setValidUntil(clinic.clinicId, addDaysKey(today, 30));
    }
  });
});

describe("Who owes (plan §15.4, §10.2; D101, D321)", () => {
  it("lists those who owe, most first, archived ones too; the Owing tab and each row's balance", async () => {
    const [small, large] = await Promise.all([addPatient("Small Owing"), addPatient("Large Owing")]);
    await issueBill(desk.tenant!, aBill({ patientId: small }), randomUUID());
    await issueBill(
      desk.tenant!,
      aBill({
        patientId: large,
        lines: [{ kind: "SERVICE", serviceId: consultation, treatmentId: null, quantity: 3, price: "800" }],
      }),
      randomUUID(),
    );
    const owing = (await listOutstanding(desk.tenant!, {})).items;
    const order = owing.map((each) => each.patient.id).filter((id) => [small, large].includes(id));
    expect(order).toEqual([large, small]);
    expect(owing.find((each) => each.patient.id === large)).toMatchObject({
      balancePaise: 240_000,
      patient: { name: "Large Owing", phone: "+919876543210", gender: "FEMALE", archived: false },
    });
    expect(owing.every((each, index) => index === 0 || owing[index - 1].balancePaise >= each.balancePaise)).toBe(true);

    const tab = await listPatients(desk.tenant!, { search: null, tab: "OWING" });
    const shown = tab.items.filter((each) => [small, large].includes(each.id));
    expect(shown.map((each) => [each.id, each.balancePaise])).toEqual([
      [large, 240_000],
      [small, 80_000],
    ]);
    expect(tab.items.every((each) => each.balancePaise > 0)).toBe(true);
    // Searched within the tab.
    const searched = await listPatients(desk.tenant!, { search: "Small Owing", tab: "OWING" });
    expect(searched.items[0]).toMatchObject({ id: small, balancePaise: 80_000 });
    // Everyone's list carries the balance; someone who does not read payments sees none, and no tab.
    const all = await listPatients(desk.tenant!, { search: "Large Owing", tab: "ALL" });
    expect(all.items[0].balancePaise).toBe(240_000);
    const unseen = await listPatients(looker.tenant!, { search: "Large Owing", tab: "ALL" });
    expect(unseen.items[0].balancePaise).toBe(0);
    await expect(listPatients(looker.tenant!, { search: null, tab: "OWING" })).rejects.toMatchObject({
      kind: "AUTHORIZATION",
    });
    expect((await listOutstanding(other.owner.tenant, {})).items).toEqual([]);
  });
});
