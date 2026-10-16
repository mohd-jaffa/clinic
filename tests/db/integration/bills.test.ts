import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { backToWaiting, markDone, sendIn } from "@/features/appointments/moves";
import { archivePatient } from "@/features/patients/api";
import { financialYear, todayKey } from "@/lib/dates/calendar";
import { walkInSchema } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Bills in the database (plan §15.2, §15.6, §11.3; R8.1, D27, D29, D282 –
 * D289): numbered from the clinic's counter for its financial year, once per
 * idempotency key; held to the price list and the doctor's fee without
 * payments.discount; a visit Billed by its bill — or at its close, by a bill
 * of its own or its arrival's fee with nothing worked on — and back to To bill
 * once nothing billed remains; No charge for a visit waiting; a patient with
 * one waiting not archived; an issued bill only ever voided.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "patients.edit",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "payments.view",
  "payments.create",
];
const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];

let clinic: TestClinic;
let desk: Member;
let maya: Member;
let mayaDoctor: string;
let consultationType: string;
const services = { consultation: "", review: "", rootCanal: "", gone: "" };
const today = todayKey();
const year = financialYear(today);

/** Maya's own consultation fee (D26), and the price list's. */
const FEE = 80_000;
const PRICES = { consultation: 50_000, review: 30_000, rootCanal: 600_000 };

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

/** A walk-in to Maya, arrived and waiting. */
async function arrived(patientId: string) {
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId: mayaDoctor, typeId: consultationType }),
    randomUUID(),
  );
  return arrival.id;
}

/** A walk-in sent in to Maya: their visit is open. */
async function inWithMaya(patientId: string) {
  const appointmentId = await arrived(patientId);
  const { visitId } = await sendIn(desk.tenant!, { appointmentId, others: "KEEP" });
  return { appointmentId, visitId };
}

/** A walk-in seen by Maya and marked done: their visit waits in To bill. */
async function doneVisit(patientId: string) {
  const visit = await inWithMaya(patientId);
  await markDone(desk.tenant!, { appointmentId: visit.appointmentId });
  return visit;
}

interface Line {
  service_id?: string | null;
  treatment_id?: string | null;
  description?: string;
  quantity?: number;
  unit_price_paise: number;
}

/** A bill as create_bill takes it, its subtotal and total added up as billing/totals.ts would. */
function aBill(patientId: string, lines: Line[], extra: Record<string, unknown> = {}) {
  const items = lines.map((line) => ({ quantity: 1, ...line }));
  const subtotal = items.reduce((sum, line) => sum + line.quantity * line.unit_price_paise, 0);
  const discount = (extra.discount_paise as number | undefined) ?? 0;
  return { patient_id: patientId, items, subtotal_paise: subtotal, total_paise: subtotal - discount, ...extra };
}

const consultationLine = (price = PRICES.consultation): Line => ({
  service_id: services.consultation,
  unit_price_paise: price,
});

const issue = (who: SignedIn, bill: Record<string, unknown>, key: string | null = randomUUID()) =>
  who.tenant!.supabase.rpc("create_bill", { p_bill: bill, p_idempotency_key: key });

interface Issued {
  bill_id: string;
  bill_number: string;
  total_paise: number;
  created: boolean;
  visit: { id: string; from: string; to: string } | null;
}

async function issued(who: SignedIn, bill: Record<string, unknown>, key: string = randomUUID()) {
  const { data, error } = await issue(who, bill, key);
  if (error) throw error;
  return data as Issued;
}

const voidBill = (who: SignedIn, id: string, reason: string | null = "Wrong patient") =>
  who.tenant!.supabase.rpc("void_bill", { p_bill_id: id, p_reason: reason });

const noCharge = (who: SignedIn, visitId: string, reason: string | null, note: string | null = null) =>
  who.tenant!.supabase.rpc("mark_no_charge", { p_visit_id: visitId, p_reason: reason, p_note: note });

const billingOf = async (visitId: string) =>
  (await admin().from("visits").select("status, billing_status, no_charge_reason").eq("id", visitId).single()).data!;

const billOf = async (id: string) => (await admin().from("bills").select("*").eq("id", id).single()).data!;

/** The billing state a visit's last audit row says it closed with. */
const closedAs = async (visitId: string) =>
  (
    await admin()
      .from("audit_logs")
      .select("changes")
      .eq("entity_id", visitId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
  ).data!.changes.billing_status;

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, maya] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
  ]);
  const { data: doctor } = await admin()
    .from("doctors")
    .update({ consultation_fee_paise: FEE })
    .eq("member_id", maya.memberId)
    .select("id")
    .single();
  mayaDoctor = doctor!.id as string;

  const [{ data: type }, { data: seeded }] = await Promise.all([
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
    admin()
      .from("services")
      .update({ price_paise: PRICES.consultation })
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .select("id")
      .single(),
  ]);
  consultationType = type!.id as string;
  services.consultation = seeded!.id as string;
  const { data: added, error } = await admin()
    .from("services")
    .insert([
      {
        clinic_id: clinic.clinicId,
        name: "Review",
        category: "CONSULTATION",
        price_paise: PRICES.review,
        active: true,
      },
      {
        clinic_id: clinic.clinicId,
        name: "Root canal",
        category: "PROCEDURE",
        price_paise: PRICES.rootCanal,
        active: true,
      },
      { clinic_id: clinic.clinicId, name: "Old X-ray", category: "INVESTIGATION", price_paise: 20_000, active: false },
    ])
    .select("id, name");
  if (error) throw error;
  const idOf = (name: string) => added.find((service) => service.name === name)!.id as string;
  services.review = idOf("Review");
  services.rootCanal = idOf("Root canal");
  services.gone = idOf("Old X-ray");
});

afterAll(removeAll);

describe("issuing a bill (plan §15.2, D27)", () => {
  it("numbers bills from the clinic's counter for its financial year, once per idempotency key", async () => {
    const patientId = await addPatient("Rohan Mehta");
    const key = randomUUID();
    const first = await issued(desk, aBill(patientId, [consultationLine()], { notes: "Paid at the desk" }), key);
    expect(first).toMatchObject({ bill_number: `${year}/0001`, total_paise: PRICES.consultation, created: true });
    expect(first.visit).toBeNull();
    expect(await billOf(first.bill_id)).toMatchObject({
      patient_id: patientId,
      visit_id: null,
      appointment_id: null,
      doctor_id: null,
      issued_on: today,
      financial_year: year,
      subtotal_paise: PRICES.consultation,
      discount_paise: 0,
      total_paise: PRICES.consultation,
      status: "ISSUED",
      notes: "Paid at the desk",
      created_by: desk.userId,
    });

    // Tapped twice: the same bill, not another.
    const again = await issued(desk, aBill(patientId, [consultationLine()]), key);
    expect(again).toMatchObject({ bill_id: first.bill_id, bill_number: `${year}/0001`, created: false });
    const second = await issued(desk, aBill(patientId, [consultationLine()]));
    expect(second.bill_number).toBe(`${year}/0002`);

    // Past 9999 the number keeps every digit.
    await admin()
      .from("bill_counters")
      .update({ last_number: 9999 })
      .eq("clinic_id", clinic.clinicId)
      .eq("financial_year", year);
    expect((await issued(desk, aBill(patientId, [consultationLine()]))).bill_number).toBe(`${year}/10000`);
  });

  it("gives bills issued at once their own numbers, and a key sent twice at once one bill", async () => {
    const patientId = await addPatient("Kiran Shah");
    const many = await Promise.all(
      Array.from({ length: 5 }, () => issued(desk, aBill(patientId, [consultationLine()]))),
    );
    expect(new Set(many.map((bill) => bill.bill_number)).size).toBe(5);

    const key = randomUUID();
    const twice = await Promise.all([
      issued(desk, aBill(patientId, [consultationLine()]), key),
      issued(desk, aBill(patientId, [consultationLine()]), key),
    ]);
    expect(twice[0].bill_id).toBe(twice[1].bill_id);
    expect(twice.map((bill) => bill.created).sort()).toEqual([false, true]);
    const { count } = await admin()
      .from("bills")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", key);
    expect(count).toBe(1);
  });

  it("copies each price-list line's name and works out its amount, in order", async () => {
    const patientId = await addPatient("Meera Iyer");
    const made = await issued(
      desk,
      aBill(patientId, [
        { ...consultationLine(), description: "Anything typed" },
        { service_id: services.rootCanal, quantity: 2, unit_price_paise: PRICES.rootCanal },
      ]),
    );
    expect(made.total_paise).toBe(PRICES.consultation + 2 * PRICES.rootCanal);
    const { data: lines } = await admin()
      .from("bill_items")
      .select("position, service_id, description, quantity, unit_price_paise, amount_paise")
      .eq("bill_id", made.bill_id)
      .order("position");
    expect(lines).toEqual([
      {
        position: 1,
        service_id: services.consultation,
        description: "Consultation",
        quantity: 1,
        unit_price_paise: PRICES.consultation,
        amount_paise: PRICES.consultation,
      },
      {
        position: 2,
        service_id: services.rootCanal,
        description: "Root canal",
        quantity: 2,
        unit_price_paise: PRICES.rootCanal,
        amount_paise: 2 * PRICES.rootCanal,
      },
    ]);
  });

  it("holds a bill without payments.discount to the price list and the doctor's fee (D29, D284, D289)", async () => {
    const patientId = await addPatient("Anil Kumar");
    const withMaya = { doctor_id: mayaDoctor };
    // A Consultation line at the bill's doctor's fee or at its own price; a review at either too.
    expect((await issue(desk, aBill(patientId, [consultationLine(FEE)], withMaya))).error).toBeNull();
    expect((await issue(desk, aBill(patientId, [consultationLine()], withMaya))).error).toBeNull();
    const review = { service_id: services.review, unit_price_paise: FEE };
    expect((await issue(desk, aBill(patientId, [review], withMaya))).error).toBeNull();

    for (const [bill, why] of [
      [aBill(patientId, [consultationLine(FEE)]), "the fee, with no doctor"],
      [aBill(patientId, [consultationLine(45_000)], withMaya), "a price of its own"],
      [
        aBill(patientId, [{ service_id: services.rootCanal, unit_price_paise: FEE }], withMaya),
        "a procedure at the fee",
      ],
      [aBill(patientId, [{ description: "Gauze", unit_price_paise: 5_000 }]), "a typed line"],
      [aBill(patientId, [consultationLine()], { discount_paise: 5_000 }), "a discount"],
    ] as const) {
      expect((await issue(desk, bill)).error?.hint, why).toBe("BILL_PRICE_NOT_ALLOWED");
    }

    // The owner gives discounts: a price changed, a typed line, a discount.
    const discounted = await issued(
      clinic.owner,
      aBill(patientId, [consultationLine(45_000), { description: "Gauze", quantity: 3, unit_price_paise: 5_000 }], {
        discount_paise: 10_000,
      }),
    );
    expect(await billOf(discounted.bill_id)).toMatchObject({
      subtotal_paise: 60_000,
      discount_paise: 10_000,
      total_paise: 50_000,
    });
  });

  it("names the treatment a price-list line is for, the patient's own (D285)", async () => {
    const patientId = await addPatient("Divya Nair");
    const other = await addPatient("Someone Else");
    const { data: treatment } = await admin()
      .from("treatments")
      .insert({ clinic_id: clinic.clinicId, patient_id: patientId, doctor_id: mayaDoctor, name: "Root canal" })
      .select("id")
      .single();
    const line = { service_id: services.rootCanal, treatment_id: treatment!.id, unit_price_paise: PRICES.rootCanal };
    const made = await issued(desk, aBill(patientId, [line]));
    const { data: kept } = await admin().from("bill_items").select("treatment_id").eq("bill_id", made.bill_id).single();
    expect(kept).toEqual({ treatment_id: treatment!.id });

    expect((await issue(desk, aBill(other, [line]))).error?.hint).toBe("RECORD_NOT_FOUND");
    // Only through a price-list line, even for whoever may type one.
    const typed = { description: "Root canal", treatment_id: treatment!.id, unit_price_paise: PRICES.rootCanal };
    expect((await issue(clinic.owner, aBill(patientId, [typed]))).error?.code).toBe("23514");
  });

  it("refuses totals that do not add up, lines out of bounds, an archived service, and what is not the patient's", async () => {
    const patientId = await addPatient("Farah Khan");
    const other = await addPatient("Ravi Das");
    const { visitId } = await inWithMaya(other);
    const theirs = await arrived(await addPatient("Gita Rao"));
    const lines = (count: number) => Array.from({ length: count }, () => consultationLine());

    for (const [bill, hint] of [
      [{ ...aBill(patientId, [consultationLine()]), subtotal_paise: 1 }, "VALIDATION_ERROR"],
      [{ ...aBill(patientId, [consultationLine()]), total_paise: 1 }, "VALIDATION_ERROR"],
      [aBill(patientId, []), "VALIDATION_ERROR"],
      [aBill(patientId, lines(51)), "VALIDATION_ERROR"],
      [aBill(patientId, [{ ...consultationLine(), quantity: 1000 }]), "VALIDATION_ERROR"],
      [aBill(patientId, [{ service_id: services.gone, unit_price_paise: 20_000 }]), "SERVICE_INACTIVE"],
      [aBill(patientId, [consultationLine()], { visit_id: visitId }), "RECORD_NOT_FOUND"],
      [aBill(patientId, [consultationLine()], { appointment_id: theirs }), "RECORD_NOT_FOUND"],
      [aBill(other, [consultationLine()], { visit_id: visitId, appointment_id: theirs }), "VALIDATION_ERROR"],
      [aBill(patientId, [consultationLine()], { doctor_id: randomUUID() }), "DOCTOR_INACTIVE"],
      [aBill(randomUUID(), [consultationLine()]), "RECORD_NOT_FOUND"],
    ] as const) {
      expect((await issue(clinic.owner, bill)).error?.hint, JSON.stringify(bill).slice(0, 120)).toBe(hint);
    }
    // Fifty lines is a bill; a line's amount beyond MAX_AMOUNT_PAISE is not.
    expect((await issue(desk, aBill(patientId, lines(50)))).error).toBeNull();
    const huge = { description: "Implants", quantity: 2, unit_price_paise: 60_000_000 };
    expect((await issue(clinic.owner, aBill(patientId, [huge]))).error?.hint).toBe("VALIDATION_ERROR");
    expect((await issue(desk, aBill(patientId, [consultationLine()]), null)).error?.hint).toBe(
      "IDEMPOTENCY_KEY_REQUIRED",
    );

    await admin().from("patients").update({ archived_at: new Date().toISOString() }).eq("id", patientId);
    expect((await issue(desk, aBill(patientId, [consultationLine()]))).error?.hint).toBe("PATIENT_ARCHIVED");
  });
});

describe("a visit's billing state (plan §15.6, D286)", () => {
  it("is Billed by its bill, stays Billed with a second, and goes back to To bill once none remains", async () => {
    const patientId = await addPatient("Sunil Verma");
    const { visitId } = await doneVisit(patientId);
    expect(await billingOf(visitId)).toMatchObject({ status: "COMPLETED", billing_status: "TO_BILL" });

    const first = await issued(desk, aBill(patientId, [consultationLine(FEE)], { visit_id: visitId }));
    expect(first.visit).toEqual({ id: visitId, from: "TO_BILL", to: "BILLED" });
    expect(await billOf(first.bill_id)).toMatchObject({ visit_id: visitId, doctor_id: mayaDoctor });
    expect((await billingOf(visitId)).billing_status).toBe("BILLED");

    const second = await issued(
      desk,
      aBill(patientId, [{ service_id: services.rootCanal, unit_price_paise: PRICES.rootCanal }], {
        visit_id: visitId,
      }),
    );
    expect(second.visit).toBeNull();

    const once = await voidBill(clinic.owner, first.bill_id);
    // The balance no longer counts it (0029).
    expect(once.data).toEqual({ previously: "ISSUED", visit: null, balance_paise: PRICES.rootCanal });
    expect((await billingOf(visitId)).billing_status).toBe("BILLED");
    const last = await voidBill(clinic.owner, second.bill_id, "Billed twice");
    expect(last.data).toEqual({
      previously: "ISSUED",
      visit: { id: visitId, from: "BILLED", to: "TO_BILL" },
      balance_paise: 0,
    });
    expect((await billingOf(visitId)).billing_status).toBe("TO_BILL");

    // Voided again, nothing more changes.
    expect((await voidBill(clinic.owner, second.bill_id, "Again")).data).toEqual({
      previously: "VOID",
      visit: null,
      balance_paise: 0,
    });
    expect(await billOf(second.bill_id)).toMatchObject({
      status: "VOID",
      void_reason: "Billed twice",
      voided_by: clinic.owner.userId,
    });
  });

  it("closes Billed after the fee at arrival with nothing worked on, To bill once a treatment was (D283)", async () => {
    const [plain, treated] = await Promise.all([addPatient("Lata Pillai"), addPatient("Mohan Rao")]);

    const plainArrival = await arrived(plain);
    const fee = await issued(desk, aBill(plain, [consultationLine(FEE)], { appointment_id: plainArrival }));
    expect(await billOf(fee.bill_id)).toMatchObject({ appointment_id: plainArrival, doctor_id: mayaDoctor });
    const { visitId: plainVisit } = await sendIn(desk.tenant!, { appointmentId: plainArrival, others: "KEEP" });
    await markDone(desk.tenant!, { appointmentId: plainArrival });
    expect((await billingOf(plainVisit)).billing_status).toBe("BILLED");
    expect(await closedAs(plainVisit)).toEqual({ from: null, to: "BILLED" });

    const treatedArrival = await arrived(treated);
    await issued(desk, aBill(treated, [consultationLine(FEE)], { appointment_id: treatedArrival }));
    const { visitId: treatedVisit } = await sendIn(desk.tenant!, { appointmentId: treatedArrival, others: "KEEP" });
    const { error: unbegun } = await maya.tenant!.supabase.rpc("create_treatment", {
      p_treatment: { name: "Root canal", status: "IN_PROGRESS" },
      p_visit_id: treatedVisit,
    });
    expect(unbegun).toBeNull();
    await markDone(desk.tenant!, { appointmentId: treatedArrival });
    expect((await billingOf(treatedVisit)).billing_status).toBe("TO_BILL");
    expect(await closedAs(treatedVisit)).toEqual({ from: null, to: "TO_BILL" });

    // Its arrival's bill voided, the visit it opened waits to be billed.
    const voided = await voidBill(clinic.owner, fee.bill_id, "Fee waived");
    expect((voided.data as { visit: unknown }).visit).toEqual({ id: plainVisit, from: "BILLED", to: "TO_BILL" });
    // The fee at arrival is taken while they are here.
    expect((await issue(desk, aBill(plain, [consultationLine()], { appointment_id: plainArrival }))).error?.hint).toBe(
      "APPOINTMENT_STATUS_NOT_ALLOWED",
    );
  });

  it("closes Billed after Bill now in the room, from the queue or a visit started from the profile", async () => {
    const [queued, walked] = await Promise.all([addPatient("Nisha Bose"), addPatient("Om Prakash")]);
    const { appointmentId, visitId } = await inWithMaya(queued);
    const inRoom = await issued(desk, aBill(queued, [consultationLine()], { visit_id: visitId }));
    expect(inRoom.visit).toBeNull();
    expect(await billingOf(visitId)).toMatchObject({ status: "OPEN", billing_status: null });
    // Back to waiting keeps the visit its bill names, to continue (D197).
    await backToWaiting(desk.tenant!, { appointmentId });
    expect(await billingOf(visitId)).toMatchObject({ status: "OPEN" });
    expect((await sendIn(desk.tenant!, { appointmentId, others: "KEEP" })).visitId).toBe(visitId);
    await markDone(desk.tenant!, { appointmentId });
    expect((await billingOf(visitId)).billing_status).toBe("BILLED");

    // The owner starts one from the profile, for Maya.
    const startVisit = async () => {
      const { data, error } = await clinic.owner.tenant.supabase
        .rpc("start_visit", { p_patient_id: walked, p_doctor_id: mayaDoctor })
        .single<{ visit_id: string }>();
      if (error) throw error;
      return data.visit_id;
    };
    const finishVisit = (visit: string) => clinic.owner.tenant.supabase.rpc("finish_visit", { p_visit_id: visit });
    const visit = await startVisit();
    await issued(desk, aBill(walked, [consultationLine(FEE)], { visit_id: visit }));
    expect((await finishVisit(visit)).data).toEqual([{ previously: "OPEN", billing: "BILLED" }]);
    expect((await billingOf(visit)).billing_status).toBe("BILLED");
    // Done again, it says how it stands.
    expect((await finishVisit(visit)).data).toEqual([{ previously: "COMPLETED", billing: "BILLED" }]);

    // A visit with nothing billed still closes To bill.
    const bare = await startVisit();
    expect((await finishVisit(bare)).data).toEqual([{ previously: "OPEN", billing: "TO_BILL" }]);
    expect((await billingOf(bare)).billing_status).toBe("TO_BILL");
  });
});

describe("No charge (plan §15.6, D287)", () => {
  it("settles a visit waiting in To bill with its reason; billed after all, it is Billed", async () => {
    const patientId = await addPatient("Priya Das");
    const open = await inWithMaya(patientId);
    expect((await noCharge(desk, open.visitId, "REVIEW")).error?.hint).toBe("VISIT_NOT_TO_BILL");
    await markDone(desk.tenant!, { appointmentId: open.appointmentId });

    expect((await noCharge(desk, open.visitId, null)).error?.hint).toBe("VALIDATION_ERROR");
    expect((await noCharge(desk, open.visitId, "OTHER")).error?.code).toBe("23514");
    expect((await noCharge(desk, open.visitId, "REVIEW")).data).toEqual([{ previously: "TO_BILL" }]);
    expect(await billingOf(open.visitId)).toMatchObject({ billing_status: "NO_CHARGE", no_charge_reason: "REVIEW" });
    // Twice changes nothing more.
    expect((await noCharge(desk, open.visitId, "COURTESY")).data).toEqual([{ previously: "NO_CHARGE" }]);
    expect((await billingOf(open.visitId)).no_charge_reason).toBe("REVIEW");

    const billed = await issued(desk, aBill(patientId, [consultationLine()], { visit_id: open.visitId }));
    expect(billed.visit).toEqual({ id: open.visitId, from: "NO_CHARGE", to: "BILLED" });
    expect(await billingOf(open.visitId)).toMatchObject({ billing_status: "BILLED", no_charge_reason: null });
    expect((await noCharge(desk, open.visitId, "REVIEW")).error?.hint).toBe("VISIT_NOT_TO_BILL");

    const other = await doneVisit(patientId);
    const { data: noted } = await noCharge(desk, other.visitId, "OTHER", "Staff family");
    expect(noted).toEqual([{ previously: "TO_BILL" }]);
    const { data: row } = await admin().from("visits").select("no_charge_note").eq("id", other.visitId).single();
    expect(row).toEqual({ no_charge_note: "Staff family" });
  });
});

describe("archiving a patient with a visit to bill (D288)", () => {
  it("is refused, naming the visit's day, until it is billed or marked No charge", async () => {
    const patientId = await addPatient("Rekha Menon");
    const { visitId } = await doneVisit(patientId);
    await expect(archivePatient(desk.tenant!, patientId)).rejects.toMatchObject({
      code: "PATIENT_HAS_VISITS_TO_BILL",
      details: { visitDate: today },
    });
    await noCharge(desk, visitId, "COURTESY");
    await expect(archivePatient(desk.tenant!, patientId)).resolves.toMatchObject({ id: patientId });
  });
});

describe("an issued bill (plan §15.2)", () => {
  it("is never edited, only voided once with a reason, stamped with who and when", async () => {
    const patientId = await addPatient("Tara Singh");
    const made = await issued(desk, aBill(patientId, [consultationLine()]));
    const { error: edited } = await admin().from("bills").update({ total_paise: 1 }).eq("id", made.bill_id);
    expect(edited?.hint).toBe("VALIDATION_ERROR");
    expect((await voidBill(clinic.owner, made.bill_id, null)).error?.hint).toBe("VALIDATION_ERROR");

    await voidBill(clinic.owner, made.bill_id, "Entered by mistake");
    const voided = await billOf(made.bill_id);
    expect(voided).toMatchObject({ status: "VOID", void_reason: "Entered by mistake", voided_by: clinic.owner.userId });
    expect(voided.voided_at).not.toBeNull();
    const { error: unvoided } = await admin().from("bills").update({ status: "ISSUED" }).eq("id", made.bill_id);
    expect(unvoided?.hint).toBe("VALIDATION_ERROR");
  });

  it("is not voided for an archived patient, nor found for another clinic's member", async () => {
    const patientId = await addPatient("Uma Shetty");
    const made = await issued(desk, aBill(patientId, [consultationLine()]));
    await admin().from("patients").update({ archived_at: new Date().toISOString() }).eq("id", patientId);
    expect((await voidBill(clinic.owner, made.bill_id)).error?.hint).toBe("PATIENT_ARCHIVED");
    expect((await voidBill(clinic.owner, randomUUID())).error?.hint).toBe("RECORD_NOT_FOUND");
  });
});
