import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { getDashboard } from "@/features/dashboard/api";
import { getDailyReport, getMonthlyReport } from "@/features/reports/api";
import { addDaysKey, addMonthsKey, dayHour, financialYear, monthStartKey, todayKey } from "@/lib/dates/calendar";
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
 * A seeded month (plan §18, §34; R10.4, the phase's exit): last month, laid
 * down as the clinic would have left it — appointments done, cancelled, not
 * come and never closed; visits with and without an appointment; bills, one
 * voided since; payments, one voided and one refunded; expenses, one
 * archived — and a little of today. Every figure of the Daily and Monthly
 * reports equals the one worked out by hand below, and the records
 * themselves; Home agrees with the reports.
 *
 * Bills cannot be issued on a day gone (create_bill issues now, and an
 * issued bill is never edited), nor visits and appointments recorded on one,
 * so those are laid down directly, each patient's balance with them as the
 * money functions keep it (D295). Payments, refunds, voids and expenses go
 * through their own functions, on the days they were made.
 *
 * Last month, by hand (₹):
 *
 * | Day | Seen          | Appointments                              | Collected        | Billed            | Spent          |
 * |-----|---------------|-------------------------------------------|------------------|-------------------|----------------|
 * | 3   | Rohan, Meera  | Rohan ✓, Meera ✓, Tara ✗ cancelled, Kiran no-show | 800 + 1,000      | 800 + 1,200       | Rent 5,000     |
 * | 10  | Rohan         | Rohan ✓, Divya never closed                | 300 (+500 voided) | 500              | Supplies 250   |
 * | 17  | Meera, Sam    | Meera ✓ (Sam's visit had none)            | 500 − 200 refund | 300 (+700 voided) | (150 archived) |
 *
 * Collected 2,400 · billed 2,800 · spent 5,250 · net −2,850. Seen: Rohan,
 * Meera, Sam — Meera came the month before, so 2 new and 1 returning.
 * Today Rohan pays his last ₹200 and Divya is seen: Meera's ₹200 is all
 * that is owed. By doctor: Maya — Rohan, 2 visits, billed 1,300, all paid;
 * Arun — Meera and Sam, 3 visits, billed 1,200, 1,000 paid; no doctor —
 * Sam's 300, paid.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "payments.view",
  "payments.create",
];

const today = todayKey();
const month = addMonthsKey(monthStartKey(today), -1);
const day3 = addDaysKey(month, 2);
const day10 = addDaysKey(month, 9);
const day17 = addDaysKey(month, 16);
const monthBefore = addDaysKey(addMonthsKey(month, -1), 19);

let clinic: TestClinic;
let desk: Member;
let books: Member;
let maya: Member;
let arun: Member;
let mayaDoctor: string;
let arunDoctor: string;
let consultationType: string;
const patients: Record<string, string> = {};

/** A rupee amount in paise. */
const rupees = (amount: number) => amount * 100;

async function laid<T extends Record<string, unknown>>(table: string, row: T): Promise<string> {
  const { data, error } = await admin()
    .from(table)
    .insert({ clinic_id: clinic.clinicId, ...row })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** An appointment of a day gone, as the queue left it. */
const appointment = (patient: string, doctorId: string, day: string, hour: number, status: string) =>
  laid("appointments", {
    patient_id: patients[patient],
    doctor_id: doctorId,
    source: "WALK_IN",
    appointment_type_id: consultationType,
    scheduled_at: dayHour(day, hour),
    duration_minutes: 15,
    status,
    ...(status === "CANCELLED" && { cancelled_at: dayHour(day, hour), cancel_reason: "Had to leave" }),
  });

/** A visit done on a day gone, for an appointment or none. */
const visit = (patient: string, doctorId: string, day: string, hour: number, appointmentId: string | null = null) =>
  laid("visits", {
    patient_id: patients[patient],
    doctor_id: doctorId,
    appointment_id: appointmentId,
    status: "COMPLETED",
    started_at: dayHour(day, hour),
    completed_at: dayHour(day, hour),
    billing_status: "BILLED",
  });

let billCount = 0;
/** A bill issued on a day gone, numbered in that day's financial year. */
const bill = (patient: string, doctorId: string | null, day: string, total: number, visitId: string | null) => {
  billCount += 1;
  return laid("bills", {
    patient_id: patients[patient],
    visit_id: visitId,
    doctor_id: doctorId,
    issued_at: dayHour(day, 12),
    issued_on: day,
    financial_year: financialYear(day),
    bill_number: `${financialYear(day)}/${9000 + billCount}`,
    subtotal_paise: rupees(total),
    total_paise: rupees(total),
    idempotency_key: randomUUID(),
  });
};

/** A payment or refund through record_payment, paid at that hour of that day, received by `who`. */
async function paid(
  who: SignedIn,
  patient: string,
  amount: number,
  day: string,
  method: string,
  kind = "PAYMENT",
): Promise<string> {
  const { data, error } = await who.tenant!.supabase.rpc("record_payment", {
    p_payment: {
      patient_id: patients[patient],
      kind,
      amount_paise: rupees(amount),
      method,
      paid_at: day === today ? undefined : dayHour(day, 13),
    },
    p_idempotency_key: randomUUID(),
  });
  if (error) throw error;
  return (data as { payment_id: string }).payment_id;
}

/** An expense through create_expense, on its day. */
async function spent(category: string, amount: number, day: string): Promise<string> {
  const { data: found } = await admin()
    .from("expense_categories")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("name", category)
    .single();
  const { data, error } = await clinic.owner.tenant.supabase.rpc("create_expense", {
    p_expense: { category_id: found!.id, amount_paise: rupees(amount), expense_date: day, payment_method: "CASH" },
    p_idempotency_key: randomUUID(),
  });
  if (error) throw error;
  return (data as { expense_id: string }).expense_id;
}

const ok = async (call: PromiseLike<{ error: unknown }>) => {
  const { error } = await call;
  if (error) throw error;
};

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, books, maya, arun] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: ["reports.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view"] }),
  ]);
  const named = (member: Member, name: string) =>
    admin().from("profiles").update({ full_name: name }).eq("id", member.userId);
  await Promise.all([named(desk, "Priya Nair"), named(maya, "Maya Rao"), named(arun, "Arun Nair")]);
  const doctorOf = async (member: Member) =>
    (await admin().from("doctors").select("id").eq("member_id", member.memberId).single()).data!.id as string;
  [mayaDoctor, arunDoctor] = await Promise.all([doctorOf(maya), doctorOf(arun)]);
  consultationType = (
    await admin()
      .from("appointment_types")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .single()
  ).data!.id as string;
  for (const name of ["Rohan", "Meera", "Tara", "Kiran", "Divya", "Sam"]) {
    const { data, error } = await clinic.owner.tenant.supabase
      .rpc("create_patient", {
        p_patient: { full_name: `${name} Test`, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    if (error) throw error;
    patients[name] = data.patient_id;
  }

  // The month before: Meera's first visit.
  await visit("Meera", arunDoctor, monthBefore, 10);

  // Day 3: Rohan and Meera seen and billed; Tara cancelled; Kiran never came.
  const rohan3 = await visit(
    "Rohan",
    mayaDoctor,
    day3,
    10,
    await appointment("Rohan", mayaDoctor, day3, 10, "COMPLETED"),
  );
  const meera3 = await visit(
    "Meera",
    arunDoctor,
    day3,
    11,
    await appointment("Meera", arunDoctor, day3, 11, "COMPLETED"),
  );
  await appointment("Tara", mayaDoctor, day3, 12, "CANCELLED");
  await appointment("Kiran", arunDoctor, day3, 12, "NO_SHOW");
  await bill("Rohan", mayaDoctor, day3, 800, rohan3);
  await bill("Meera", arunDoctor, day3, 1_200, meera3);
  // Day 10: Rohan again; Divya's appointment never closed.
  const rohan10 = await visit(
    "Rohan",
    mayaDoctor,
    day10,
    10,
    await appointment("Rohan", mayaDoctor, day10, 10, "COMPLETED"),
  );
  await appointment("Divya", mayaDoctor, day10, 11, "SCHEDULED");
  await bill("Rohan", mayaDoctor, day10, 500, rohan10);
  // Day 17: Meera seen and billed — a bill voided since; Sam seen with no appointment, billed with no doctor.
  const meera17 = await visit(
    "Meera",
    arunDoctor,
    day17,
    10,
    await appointment("Meera", arunDoctor, day17, 10, "COMPLETED"),
  );
  const sam17 = await visit("Sam", arunDoctor, day17, 11);
  const wrong = await bill("Meera", arunDoctor, day17, 700, meera17);
  await bill("Sam", null, day17, 300, sam17);
  // Each patient's balance as the money functions keep it (D295): what was billed them.
  const { error: unbalanced } = await admin()
    .from("patient_balances")
    .insert([
      { clinic_id: clinic.clinicId, patient_id: patients.Rohan, billed_paise: rupees(1_300) },
      { clinic_id: clinic.clinicId, patient_id: patients.Meera, billed_paise: rupees(1_900) },
      { clinic_id: clinic.clinicId, patient_id: patients.Sam, billed_paise: rupees(300) },
    ]);
  if (unbalanced) throw unbalanced;
  await ok(clinic.owner.tenant.supabase.rpc("void_bill", { p_bill_id: wrong, p_reason: "Wrong lines" }));

  // The payments, on their days: Meera's ₹500 of day 10 voided; Sam's ₹200 handed back on day 17.
  await paid(desk, "Rohan", 800, day3, "CASH");
  await paid(desk, "Meera", 1_000, day3, "UPI");
  await paid(desk, "Rohan", 300, day10, "CASH");
  const bounced = await paid(desk, "Meera", 500, day10, "CASH");
  await ok(clinic.owner.tenant.supabase.rpc("void_payment", { p_payment_id: bounced, p_reason: "Entered twice" }));
  await paid(desk, "Sam", 500, day17, "CASH");
  await paid(clinic.owner, "Sam", 200, day17, "CASH", "REFUND");

  // The expenses: day 17's supplies archived since.
  await spent("Rent", 5_000, day3);
  await spent("Supplies", 250, day10);
  const archived = await spent("Supplies", 150, day17);
  await ok(clinic.owner.tenant.supabase.rpc("archive_expense", { p_expense_id: archived, p_archived: true }));

  // Today: Divya seen; Rohan pays his last ₹200.
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({
      patient: { mode: "FOUND", id: patients.Divya },
      doctorId: mayaDoctor,
      typeId: consultationType,
    }),
    randomUUID(),
  );
  await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
  await markDone(desk.tenant!, { appointmentId: arrival.id });
  await paid(desk, "Rohan", 200, today, "CASH");
});

afterAll(removeAll);

/** Last month's days as the chart reads them: these three as worked out, every other at nothing. */
function chartDays() {
  const named: Record<string, { collectedPaise: number; expensesPaise: number }> = {
    [day3]: { collectedPaise: rupees(1_800), expensesPaise: rupees(5_000) },
    [day10]: { collectedPaise: rupees(300), expensesPaise: rupees(250) },
    [day17]: { collectedPaise: rupees(300), expensesPaise: 0 },
  };
  const days = [];
  for (let day = month; day < monthStartKey(today); day = addDaysKey(day, 1)) {
    days.push({ day, ...(named[day] ?? { collectedPaise: 0, expensesPaise: 0 }) });
  }
  return days;
}

describe("last month's report, against the figures worked out by hand (plan §18; D53, D345, D346)", () => {
  it("has its patients, new and returning, its appointments, and its money", async () => {
    await expect(getMonthlyReport(books.tenant!, { month })).resolves.toMatchObject({
      month,
      patientsSeen: 3,
      newPatients: 2,
      returningPatients: 1,
      appointments: 6,
      statuses: { COMPLETED: 4, CANCELLED: 1, NO_SHOW: 1, SCHEDULED: 1 },
      collectedPaise: rupees(2_400),
      billedPaise: rupees(2_800),
      expensesPaise: rupees(5_250),
      netPaise: rupees(-2_850),
      outstandingPaise: rupees(200),
    });
  });

  it("has every day of the month for the chart, the three with money as worked out", async () => {
    const { days } = await getMonthlyReport(books.tenant!, { month });
    expect(days).toEqual(chartDays());
  });

  it("has each doctor's patients, visits, bills and what is paid of them to date, the bills with no doctor last", async () => {
    const { doctors } = await getMonthlyReport(books.tenant!, { month });
    expect(doctors).toEqual([
      {
        doctorId: arunDoctor,
        doctorName: "Arun Nair",
        patientsSeen: 2,
        visits: 3,
        billedPaise: rupees(1_200),
        paidPaise: rupees(1_000),
      },
      {
        doctorId: mayaDoctor,
        doctorName: "Maya Rao",
        patientsSeen: 1,
        visits: 2,
        billedPaise: rupees(1_300),
        paidPaise: rupees(1_300),
      },
      {
        doctorId: null,
        doctorName: null,
        patientsSeen: 0,
        visits: 0,
        billedPaise: rupees(300),
        paidPaise: rupees(300),
      },
    ]);
  });
});

describe("last month's days, against the figures worked out by hand (plan §18; D49, D345, D346)", () => {
  it("day 3: two seen, a cancellation and a no-show; each payment by who took it and how", async () => {
    await expect(getDailyReport(books.tenant!, { day: day3 })).resolves.toEqual({
      day: day3,
      patientsSeen: 2,
      appointments: 3,
      statuses: { COMPLETED: 2, CANCELLED: 1, NO_SHOW: 1 },
      collectedPaise: rupees(1_800),
      billedPaise: rupees(2_000),
      expensesPaise: rupees(5_000),
      netPaise: rupees(-3_200),
      collections: [
        {
          receivedBy: desk.userId,
          receiverName: "Priya Nair",
          method: "CASH",
          payments: 1,
          receivedPaise: rupees(800),
          refunds: 0,
          refundedPaise: 0,
        },
        {
          receivedBy: desk.userId,
          receiverName: "Priya Nair",
          method: "UPI",
          payments: 1,
          receivedPaise: rupees(1_000),
          refunds: 0,
          refundedPaise: 0,
        },
      ],
      voided: { payments: 0, paymentPaise: 0, refunds: 0, refundPaise: 0 },
    });
  });

  it("day 10: the voided payment out of Collected and listed as voided; an appointment never closed", async () => {
    await expect(getDailyReport(books.tenant!, { day: day10 })).resolves.toMatchObject({
      patientsSeen: 1,
      appointments: 2,
      statuses: { COMPLETED: 1, SCHEDULED: 1 },
      collectedPaise: rupees(300),
      billedPaise: rupees(500),
      expensesPaise: rupees(250),
      netPaise: rupees(50),
      voided: { payments: 1, paymentPaise: rupees(500), refunds: 0, refundPaise: 0 },
    });
  });

  it("day 17: a visit with no appointment seen, the voided bill and the archived expense out, the refund taken off", async () => {
    await expect(getDailyReport(books.tenant!, { day: day17 })).resolves.toMatchObject({
      patientsSeen: 2,
      appointments: 1,
      statuses: { COMPLETED: 1 },
      collectedPaise: rupees(300),
      billedPaise: rupees(300),
      expensesPaise: 0,
      netPaise: rupees(300),
      collections: [
        {
          receivedBy: clinic.owner.userId,
          receiverName: "Asha Menon",
          method: "CASH",
          payments: 0,
          receivedPaise: 0,
          refunds: 1,
          refundedPaise: rupees(200),
        },
        {
          receivedBy: desk.userId,
          receiverName: "Priya Nair",
          method: "CASH",
          payments: 1,
          receivedPaise: rupees(500),
          refunds: 0,
          refundedPaise: 0,
        },
      ],
    });
  });

  it("sums the month's days to the month", async () => {
    const days = await Promise.all([day3, day10, day17].map((day) => getDailyReport(books.tenant!, { day })));
    const monthly = await getMonthlyReport(books.tenant!, { month });
    for (const figure of ["collectedPaise", "billedPaise", "expensesPaise", "netPaise"] as const) {
      expect(
        days.reduce((sum, day) => sum + day[figure], 0),
        figure,
      ).toBe(monthly[figure]);
    }
  });
});

describe("the reports against the records themselves", () => {
  it("collect, bill, spend and owe what the records hold, leaving out what was voided or archived", async () => {
    const from = dayHour(month, 0);
    const to = dayHour(monthStartKey(today), 0);
    const [{ data: payments }, { data: bills }, { data: expenses }, { data: balances }] = await Promise.all([
      admin()
        .from("payments")
        .select("kind, amount_paise")
        .eq("clinic_id", clinic.clinicId)
        .eq("status", "RECORDED")
        .gte("paid_at", from)
        .lt("paid_at", to),
      admin()
        .from("bills")
        .select("total_paise")
        .eq("clinic_id", clinic.clinicId)
        .eq("status", "ISSUED")
        .gte("issued_on", month)
        .lt("issued_on", monthStartKey(today)),
      admin()
        .from("expenses")
        .select("amount_paise")
        .eq("clinic_id", clinic.clinicId)
        .is("archived_at", null)
        .gte("expense_date", month)
        .lt("expense_date", monthStartKey(today)),
      admin().from("patient_balances").select("balance_paise").eq("clinic_id", clinic.clinicId).gt("balance_paise", 0),
    ]);
    const sum = (rows: { [key: string]: number }[] | null, column: string) =>
      (rows ?? []).reduce((all, row) => all + Number(row[column]), 0);
    const monthly = await getMonthlyReport(books.tenant!, { month });
    expect(
      (payments ?? []).reduce((all, row) => all + (row.kind === "REFUND" ? -row.amount_paise : row.amount_paise), 0),
    ).toBe(monthly.collectedPaise);
    expect(sum(bills, "total_paise")).toBe(monthly.billedPaise);
    expect(sum(expenses, "amount_paise")).toBe(monthly.expensesPaise);
    expect(sum(balances, "balance_paise")).toBe(monthly.outstandingPaise);
  });
});

describe("Home, against the reports (plan §17)", () => {
  it("collects, sees and owes today what the day's and the month's reports say", async () => {
    const [home, daily, thisMonth] = await Promise.all([
      getDashboard(clinic.owner.tenant),
      getDailyReport(books.tenant!, { day: today }),
      getMonthlyReport(books.tenant!, { month: monthStartKey(today) }),
    ]);
    expect(daily).toMatchObject({ patientsSeen: 1, appointments: 1, collectedPaise: rupees(200) });
    expect(home.day).toEqual({ appointments: daily.appointments, patientsSeen: daily.patientsSeen });
    expect(home.money).toEqual({ collectedPaise: daily.collectedPaise, outstandingPaise: thisMonth.outstandingPaise });
    expect(thisMonth.outstandingPaise).toBe(rupees(200));
    expect(home.owing).toEqual([
      { patient: { id: patients.Meera, name: "Meera Test", number: expect.any(Number) }, balancePaise: rupees(200) },
    ]);
  });
});
