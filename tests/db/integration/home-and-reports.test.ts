import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { issueBill, voidBill } from "@/features/billing/api";
import { recordPayment, voidPayment } from "@/features/billing/payments";
import { getDashboard } from "@/features/dashboard/api";
import { createExpense } from "@/features/expenses/api";
import { getDailyReport, getMonthlyReport } from "@/features/reports/api";
import { addDaysKey, addMonthsKey, dayHour, monthStartKey, todayKey } from "@/lib/dates/calendar";
import { billSchema, expenseSchema, paymentSchema, walkInSchema } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Home's sections and the reports in the database (plan §17, §18; R10.1,
 * D345 – D349): a clinic's day of walk-ins — seen, seen twice, waiting, in,
 * cancelled, not come — bills issued and voided, payments and a refund, a
 * payment of yesterday voided today, an expense; each figure as worked out
 * by hand: the appointments without the cancelled one, the patients seen
 * once each, collected less refunds, billed, spent, the net, what is owed —
 * a voided bill or payment out of its own day. Home's sections each with its
 * permission, a doctor's own day and patients; the getting-started steps
 * until the first patient; the day-end collections by who took the money
 * and how; the month's patients new and returning, and by doctor.
 */
type Member = SignedIn & { memberId: string };
type Json = Record<string, unknown>;

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "payments.view",
  "payments.create",
];
const CLINICAL: Permission[] = ["patients.view", "appointments.view", "visits.view", "visits.create", "visits.edit"];

let clinic: TestClinic;
let desk: Member;
let maya: Member;
let arun: Member;
let books: Member;
let plain: Member;
let mayaDoctor: string;
let arunDoctor: string;
let consultationType: string;
let consultation: string;
let dressing: string;
let rohan: string;
let meera: string;
let kiran: string;
let divya: string;
/** Rohan's first visit, billed; his second and Meera's, waiting in To bill. */
let rohanSecond: string;
let meeraVisit: string;
let kiranToken: number;
let tomorrowsBooking: string;
let yesterdaysPayment: string;

const today = todayKey();
const yesterday = addDaysKey(today, -1);
const tomorrow = addDaysKey(today, 1);
const sameMonth = (day: string) => day.slice(0, 7) === today.slice(0, 7);

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

/** A walk-in, as the desk adds one. */
const walkIn = (patientId: string, doctorId: string) =>
  addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultationType }),
    randomUUID(),
  );

/** A walk-in seen and done: their visit waiting in To bill. */
async function seen(patientId: string, doctorId: string) {
  const arrival = await walkIn(patientId, doctorId);
  const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
  await markDone(desk.tenant!, { appointmentId: arrival.id });
  return visitId;
}

const moved = async (appointmentId: string, status: "CANCELLED" | "NO_SHOW") => {
  const { error } = await clinic.owner.tenant.supabase.rpc("change_appointment_status", {
    p_appointment_id: appointmentId,
    p_status: status,
    p_reason: status === "CANCELLED" ? "Had to leave" : null,
  });
  if (error) throw error;
};

const aBill = (input: Record<string, unknown>) =>
  billSchema.parse({
    visitId: null,
    appointmentId: null,
    doctorId: null,
    discount: { kind: "NONE" },
    notes: "",
    collect: { on: false },
    lines: [{ kind: "SERVICE", serviceId: dressing, treatmentId: null, quantity: 1, price: "300" }],
    ...input,
  });

const aPayment = (input: Record<string, unknown>) =>
  paymentSchema.parse({ kind: "PAYMENT", paidOn: today, method: "CASH", reference: "", note: "", ...input });

async function summaryOf(member: SignedIn): Promise<Json> {
  const { data, error } = await member.tenant!.supabase.rpc("dashboard_summary", {
    p_list_limit: 5,
    p_queue_limit: 3,
  });
  if (error) throw error;
  return data as Json;
}

async function dailyOf(member: SignedIn, day: string): Promise<Json> {
  const { data, error } = await member.tenant!.supabase.rpc("report_daily", { p_day: day });
  if (error) throw error;
  return data as Json;
}

async function monthlyOf(member: SignedIn, day: string): Promise<Json> {
  const { data, error } = await member.tenant!.supabase.rpc("report_monthly", { p_month: day });
  if (error) throw error;
  return data as Json;
}

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, maya, arun, books, plain] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    // Arun reads payments too, so his lists keep to his own patients.
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: [...CLINICAL, "payments.view"] }),
    addMember(clinic.clinicId, { permissions: ["reports.view"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view"] }),
  ]);
  const named = (member: Member, name: string) =>
    admin().from("profiles").update({ full_name: name }).eq("id", member.userId);
  await Promise.all([named(desk, "Priya Nair"), named(books, "Kavya Iyer")]);
  const doctorOf = async (member: Member, name: string) => {
    await named(member, name);
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
  const [{ data: type }, { data: seeded }, { data: added }] = await Promise.all([
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
    admin()
      .from("services")
      .update({ price_paise: 80_000 })
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .select("id")
      .single(),
    admin()
      .from("services")
      .insert({ clinic_id: clinic.clinicId, name: "Dressing", category: "PROCEDURE", price_paise: 30_000 })
      .select("id")
      .single(),
  ]);
  consultationType = type!.id as string;
  consultation = seeded!.id as string;
  dressing = added!.id as string;

  const tara = await addPatient("Tara Shah");
  const sam = await addPatient("Sam Thomas");
  [rohan, meera, kiran, divya] = await Promise.all(
    ["Rohan Mehta", "Meera Pillai", "Kiran Das", "Divya Menon"].map(addPatient),
  );
  // Meera came once before, last month: she returns this month.
  const before = dayHour(addDaysKey(addMonthsKey(monthStartKey(today), -1), 14), 10);
  const { error: unvisited } = await admin().from("visits").insert({
    clinic_id: clinic.clinicId,
    patient_id: meera,
    doctor_id: arunDoctor,
    status: "COMPLETED",
    started_at: before,
    completed_at: before,
    billing_status: "NO_CHARGE",
    no_charge_reason: "REVIEW",
  });
  if (unvisited) throw unvisited;

  // Today: Rohan seen by Maya, Meera by Arun, Rohan by Maya again.
  const rohanFirst = await seen(rohan, mayaDoctor);
  meeraVisit = await seen(meera, arunDoctor);
  rohanSecond = await seen(rohan, mayaDoctor);
  // Divya in with Maya; Kiran waiting for Arun; Tara gone, cancelled; Sam never came.
  const divyaArrival = await walkIn(divya, mayaDoctor);
  await sendIn(desk.tenant!, { appointmentId: divyaArrival.id, others: "KEEP" });
  const kiranArrival = await walkIn(kiran, arunDoctor);
  kiranToken = kiranArrival.token;
  await moved((await walkIn(tara, mayaDoctor)).id, "CANCELLED");
  await moved((await walkIn(sam, arunDoctor)).id, "NO_SHOW");
  // Tara booked with Maya for tomorrow.
  const { data: booked, error: unbooked } = await clinic.owner.tenant.supabase
    .rpc("create_appointment", {
      p_appointment: {
        patient_id: tara,
        doctor_id: mayaDoctor,
        appointment_type_id: consultationType,
        scheduled_at: dayHour(tomorrow, 10),
        duration_minutes: 15,
      },
      p_idempotency_key: randomUUID(),
    })
    .single<{ appointment_id: string }>();
  if (unbooked) throw unbooked;
  tomorrowsBooking = booked.appointment_id;

  // Rohan's first visit billed ₹800, ₹500 of it collected in cash by the desk.
  await issueBill(
    desk.tenant!,
    aBill({
      patientId: rohan,
      visitId: rohanFirst,
      lines: [{ kind: "SERVICE", serviceId: consultation, treatmentId: null, quantity: 1, price: "800" }],
      collect: { on: true, amount: "500", method: "CASH", reference: "" },
    }),
    randomUUID(),
  );
  // Meera pays ₹1,000 by UPI ahead; a ₹300 dressing with no doctor takes from it; ₹200 handed back.
  await recordPayment(desk.tenant!, aPayment({ patientId: meera, amount: "1000", method: "UPI" }), randomUUID());
  await issueBill(desk.tenant!, aBill({ patientId: meera }), randomUUID());
  await recordPayment(
    clinic.owner.tenant,
    aPayment({ patientId: meera, kind: "REFUND", amount: "200", method: "UPI" }),
    randomUUID(),
  );
  // Two dressings billed to Meera by mistake, voided.
  const { billId: wrong } = await issueBill(
    desk.tenant!,
    aBill({
      patientId: meera,
      lines: [{ kind: "SERVICE", serviceId: dressing, treatmentId: null, quantity: 2, price: "300" }],
    }),
    randomUUID(),
  );
  await voidBill(clinic.owner.tenant, wrong, { reason: "Wrong patient" });
  // Rohan's ₹400 of yesterday, in cash.
  ({ paymentId: yesterdaysPayment } = await recordPayment(
    desk.tenant!,
    aPayment({ patientId: rohan, amount: "400", paidOn: yesterday }),
    randomUUID(),
  ));
  // Meera's follow-up is due today.
  await admin().from("visits").update({ follow_up_on: today }).eq("id", meeraVisit);
  // The clinic's ₹250 of supplies.
  const { data: category } = await admin()
    .from("expense_categories")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("name", "Supplies")
    .single();
  await createExpense(
    clinic.owner.tenant,
    expenseSchema.parse({ categoryId: category!.id, amount: "250", day: today, method: "CASH", description: "Gauze" }),
    randomUUID(),
    "req_expense",
  );
});

afterAll(removeAll);

describe("a voided payment leaves its own day (D345)", () => {
  it("counts yesterday's payment on yesterday until it is voided, and then lists it as voided", async () => {
    await expect(dailyOf(books, yesterday)).resolves.toMatchObject({
      collected_paise: 40_000,
      voided: { payments: 0, payment_paise: 0 },
    });
    await voidPayment(clinic.owner.tenant, yesterdaysPayment, { reason: "Entered twice" });
    await expect(dailyOf(books, yesterday)).resolves.toMatchObject({
      collected_paise: 0,
      net_paise: 0,
      collections: [],
      voided: { payments: 1, payment_paise: 40_000, refunds: 0, refund_paise: 0 },
    });
  });
});

describe("Home (plan §17; D347 – D349)", () => {
  it("gives the owner every section: the day, the money, the queue, To bill, follow-ups, tomorrow and the lists", async () => {
    const home = await summaryOf(clinic.owner);
    expect(home).toMatchObject({
      today,
      // Six come today, the cancelled one left out (D346); Rohan seen twice is one patient.
      day: { appointments: 6, patients_seen: 2 },
      // ₹500 + ₹1,000 − ₹200; Rohan owes ₹300, Meera's ₹500 ahead taking nothing off it.
      money: { collected_paise: 130_000, outstanding_paise: 30_000 },
      to_bill: { count: 2 },
      follow_ups: { today: 1, overdue: 0, lapsed: 0 },
      upcoming: { count: 1 },
      owing: [{ patient_id: rohan, patient_name: "Rohan Mehta", balance_paise: 30_000 }],
      getting_started: null,
    });
    expect(home.queue).toEqual([
      {
        doctor_id: arunDoctor,
        doctor_name: "Arun Nair",
        with_doctor: 0,
        waiting: 1,
        next: [
          expect.objectContaining({
            patient_id: kiran,
            patient_name: "Kiran Das",
            token_number: kiranToken,
            urgent: false,
          }),
        ],
      },
      { doctor_id: mayaDoctor, doctor_name: "Maya Rao", with_doctor: 1, waiting: 0, next: [] },
    ]);
    // Oldest done first: Meera's, then Rohan's second.
    expect((home.to_bill as { visits: Json[] }).visits.map((visit) => visit.visit_id)).toEqual([
      meeraVisit,
      rohanSecond,
    ]);
    expect((home.follow_ups as { due: Json[] }).due).toEqual([
      expect.objectContaining({ kind: "VISIT", visit_id: meeraVisit, patient_name: "Meera Pillai", due_on: today }),
    ]);
    expect((home.upcoming as { appointments: Json[] }).appointments).toEqual([
      expect.objectContaining({
        appointment_id: tomorrowsBooking,
        patient_name: "Tara Shah",
        doctor_name: "Maya Rao",
        type_name: "Consultation",
        status: "SCHEDULED",
      }),
    ]);
    // The last standing, newest first: the refund, Meera's ₹1,000, Rohan's ₹500 — not yesterday's voided ₹400.
    expect((home.payments as Json[]).map(({ kind, amount_paise, method }) => [kind, amount_paise, method])).toEqual([
      ["REFUND", 20_000, "UPI"],
      ["PAYMENT", 100_000, "UPI"],
      ["PAYMENT", 50_000, "CASH"],
    ]);
    expect(home.expenses).toEqual([
      expect.objectContaining({ category_name: "Supplies", description: "Gauze", amount_paise: 25_000, day: today }),
    ]);
  });

  it("reads the same through the feature function Home's route calls (R10.2)", async () => {
    const home = await getDashboard(clinic.owner.tenant);
    expect(home).toMatchObject({
      today,
      day: { appointments: 6, patientsSeen: 2 },
      money: { collectedPaise: 130_000, outstandingPaise: 30_000 },
      toBill: { count: 2 },
      followUps: { today: 1, overdue: 0, lapsed: 0 },
      upcoming: { count: 1 },
      owing: [{ patient: { id: rohan, name: "Rohan Mehta" }, balancePaise: 30_000 }],
      gettingStarted: null,
    });
    expect(home.queue!.map(({ doctorName, withDoctor, waiting }) => [doctorName, withDoctor, waiting])).toEqual([
      ["Arun Nair", 0, 1],
      ["Maya Rao", 1, 0],
    ]);
    expect(home.queue![0].next).toEqual([
      expect.objectContaining({ patient: expect.objectContaining({ id: kiran }), token: kiranToken, urgent: false }),
    ]);
    expect(home.toBill!.visits.map((visit) => visit.visitId)).toEqual([meeraVisit, rohanSecond]);
    expect(home.followUps!.due).toEqual([
      {
        kind: "VISIT",
        id: meeraVisit,
        patient: expect.objectContaining({ id: meera }),
        title: null,
        doctorName: "Arun Nair",
      },
    ]);
    expect(home.upcoming!.appointments).toEqual([
      expect.objectContaining({ id: tomorrowsBooking, doctorName: "Maya Rao", typeName: "Consultation" }),
    ]);
    expect(home.payments!.map(({ kind, amountPaise, method }) => [kind, amountPaise, method])).toEqual([
      ["REFUND", 20_000, "UPI"],
      ["PAYMENT", 100_000, "UPI"],
      ["PAYMENT", 50_000, "CASH"],
    ]);
    expect(home.expenses).toEqual([
      expect.objectContaining({ categoryName: "Supplies", description: "Gauze", amountPaise: 25_000, method: "CASH" }),
    ]);
  });

  it("gives each member only the sections their permissions open", async () => {
    const [front, accounts, nobody] = await Promise.all([summaryOf(desk), summaryOf(books), summaryOf(plain)]);
    expect(front).toMatchObject({ day: { appointments: 6 }, money: null, expenses: null, to_bill: { count: 2 } });
    for (const section of ["queue", "follow_ups", "upcoming", "owing", "payments"]) {
      expect(front[section], section).not.toBeNull();
    }
    expect(accounts).toMatchObject({ money: { collected_paise: 130_000, outstanding_paise: 30_000 } });
    for (const home of [accounts, nobody]) {
      for (const section of ["day", "queue", "to_bill", "follow_ups", "upcoming", "owing", "payments", "expenses"]) {
        expect(home[section], section).toBeNull();
      }
    }
    expect(nobody.money).toBeNull();
  });

  it("gives a doctor their own day, queue and tomorrow, and only their own patients' follow-ups and money (D347)", async () => {
    const [hers, his] = await Promise.all([summaryOf(maya), summaryOf(arun)]);
    // Maya: Rohan twice and Divya — Tara cancelled; Rohan seen.
    expect(hers).toMatchObject({
      day: { appointments: 3, patients_seen: 1 },
      upcoming: { count: 1 },
      follow_ups: { today: 0, due: [] },
      money: null,
      to_bill: null,
    });
    expect(hers.queue).toEqual([expect.objectContaining({ doctor_id: mayaDoctor, with_doctor: 1, waiting: 0 })]);
    // Arun: Meera, Kiran and Sam; Meera seen. His To bill, payments and dues are his patients' only.
    expect(his).toMatchObject({
      day: { appointments: 3, patients_seen: 1 },
      upcoming: { count: 0, appointments: [] },
      follow_ups: { today: 1 },
      to_bill: { count: 1, visits: [expect.objectContaining({ visit_id: meeraVisit })] },
      owing: [],
    });
    expect(his.queue).toEqual([expect.objectContaining({ doctor_id: arunDoctor, waiting: 1 })]);
    expect((his.payments as Json[]).map((payment) => payment.patient_id)).toEqual([meera, meera]);
  });

  it("shows a new clinic its getting-started steps, ticked as done, until its first patient (D348)", async () => {
    const fresh = await registerClinic();
    const steps = async () => (await summaryOf(fresh.owner)).getting_started;
    await expect(steps()).resolves.toEqual({ prices: false, team: false });
    await admin().from("services").update({ price_paise: 50_000 }).eq("clinic_id", fresh.clinicId);
    await addMember(fresh.clinicId, { permissions: ["patients.view"] });
    await expect(steps()).resolves.toEqual({ prices: true, team: true });
    const { error } = await fresh.owner.tenant.supabase.rpc("create_patient", {
      p_patient: { full_name: "Anil Kumar", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    });
    expect(error).toBeNull();
    await expect(steps()).resolves.toBeNull();
  });
});

describe("the day's report (plan §18; D49, D345, D346)", () => {
  it("works out the day as by hand, a voided bill out of Billed", async () => {
    await expect(dailyOf(books, today)).resolves.toMatchObject({
      day: today,
      patients_seen: 2,
      appointments: 6,
      statuses: { COMPLETED: 3, IN_PROGRESS: 1, ARRIVED: 1, CANCELLED: 1, NO_SHOW: 1 },
      collected_paise: 130_000,
      // ₹800 and ₹300; the voided ₹600 left out.
      billed_paise: 110_000,
      expenses_paise: 25_000,
      net_paise: 105_000,
      voided: { payments: 0, payment_paise: 0, refunds: 0, refund_paise: 0 },
    });
  });

  it("sums the day-end collections by who took the money and how, to the day's collected (D49)", async () => {
    const daily = await dailyOf(books, today);
    expect(daily.collections).toEqual([
      {
        received_by: clinic.owner.userId,
        receiver_name: "Asha Menon",
        method: "UPI",
        payments: 0,
        received_paise: 0,
        refunds: 1,
        refunded_paise: 20_000,
      },
      {
        received_by: desk.userId,
        receiver_name: "Priya Nair",
        method: "CASH",
        payments: 1,
        received_paise: 50_000,
        refunds: 0,
        refunded_paise: 0,
      },
      {
        received_by: desk.userId,
        receiver_name: "Priya Nair",
        method: "UPI",
        payments: 1,
        received_paise: 100_000,
        refunds: 0,
        refunded_paise: 0,
      },
    ]);
    const handed = (daily.collections as { received_paise: number; refunded_paise: number }[]).reduce(
      (sum, row) => sum + row.received_paise - row.refunded_paise,
      0,
    );
    expect(handed).toBe(daily.collected_paise);
  });

  it("is read with reports.view only, of today or a day before", async () => {
    for (const member of [desk, maya, plain]) {
      const { error } = await member.tenant!.supabase.rpc("report_daily", { p_day: today });
      expect(error?.hint).toBe("AUTH_PERMISSION_DENIED");
    }
    const { error } = await books.tenant!.supabase.rpc("report_daily", { p_day: tomorrow });
    expect(error?.hint).toBe("VALIDATION_ERROR");
    await expect(dailyOf(clinic.owner, today)).resolves.toMatchObject({ collected_paise: 130_000 });
  });
});

describe("the month's report (plan §18; D53)", () => {
  it("works out the month as by hand: patients new and returning, appointments, money, owed today", async () => {
    const monthly = await monthlyOf(books, today);
    expect(monthly).toMatchObject({
      month: monthStartKey(today),
      // Rohan's first visit ever; Meera came months ago.
      patients_seen: 2,
      new_patients: 1,
      returning_patients: 1,
      appointments: sameMonth(tomorrow) ? 7 : 6,
      collected_paise: 130_000,
      billed_paise: 110_000,
      expenses_paise: 25_000,
      net_paise: 105_000,
      outstanding_paise: 30_000,
    });
    // Each day of the month for the chart, today's as the day's report has it.
    const days = monthly.days as { day: string; collected_paise: number; expenses_paise: number }[];
    expect(days[0].day).toBe(monthStartKey(today));
    expect(days.at(-1)!.day).toBe(addDaysKey(addMonthsKey(monthStartKey(today), 1), -1));
    expect(days.find((day) => day.day === today)).toEqual({
      day: today,
      collected_paise: 130_000,
      expenses_paise: 25_000,
    });
    expect(days.reduce((sum, day) => sum + day.collected_paise, 0)).toBe(130_000);
  });

  it("gives each doctor their patients seen, visits, billed and paid to date, and the bills with no doctor last", async () => {
    const monthly = await monthlyOf(books, today);
    expect(monthly.doctors).toEqual([
      { doctor_id: arunDoctor, doctor_name: "Arun Nair", patients_seen: 1, visits: 1, billed_paise: 0, paid_paise: 0 },
      {
        doctor_id: mayaDoctor,
        doctor_name: "Maya Rao",
        patients_seen: 1,
        visits: 2,
        billed_paise: 80_000,
        paid_paise: 50_000,
      },
      { doctor_id: null, doctor_name: null, patients_seen: 0, visits: 0, billed_paise: 30_000, paid_paise: 30_000 },
    ]);
  });

  it("reads the same through the feature functions the reports' routes call (R10.3)", async () => {
    await expect(getDailyReport(books.tenant!, { day: today })).resolves.toMatchObject({
      day: today,
      patientsSeen: 2,
      appointments: 6,
      statuses: { COMPLETED: 3, CANCELLED: 1, NO_SHOW: 1 },
      collectedPaise: 130_000,
      billedPaise: 110_000,
      expensesPaise: 25_000,
      netPaise: 105_000,
      voided: { payments: 0, paymentPaise: 0 },
    });
    const monthly = await getMonthlyReport(books.tenant!, { month: monthStartKey(today) });
    expect(monthly).toMatchObject({
      month: monthStartKey(today),
      patientsSeen: 2,
      newPatients: 1,
      returningPatients: 1,
      collectedPaise: 130_000,
      outstandingPaise: 30_000,
    });
    expect(monthly.days.find((day) => day.day === today)).toEqual({
      day: today,
      collectedPaise: 130_000,
      expensesPaise: 25_000,
    });
    expect(monthly.doctors.at(-1)).toEqual({
      doctorId: null,
      doctorName: null,
      patientsSeen: 0,
      visits: 0,
      billedPaise: 30_000,
      paidPaise: 30_000,
    });
  });

  it("is read with reports.view only, of this month or one before", async () => {
    const { error } = await desk.tenant!.supabase.rpc("report_monthly", { p_month: today });
    expect(error?.hint).toBe("AUTH_PERMISSION_DENIED");
    const { error: ahead } = await books.tenant!.supabase.rpc("report_monthly", {
      p_month: addMonthsKey(monthStartKey(today), 1),
    });
    expect(ahead?.hint).toBe("VALIDATION_ERROR");
    await expect(monthlyOf(books, addMonthsKey(monthStartKey(today), -1))).resolves.toMatchObject({
      patients_seen: 1,
      new_patients: 1,
      returning_patients: 0,
    });
  });
});
