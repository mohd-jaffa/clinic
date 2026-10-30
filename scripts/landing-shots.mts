/**
 * The landing page's screenshots (`src/assets/landing/`, plan §21, D401): a
 * made-up clinic — Sunrise Family Clinic, Kochi — given a month of visits,
 * bills and expenses and a busy morning, photographed in the built app in
 * the light and the dark theme, and deleted again.
 *
 *   npm run build && npx next start -p 3108                   (the built app, in another terminal)
 *   npx tsx --env-file=.env.local scripts/landing-shots.mts
 *
 * LANDING_APP_URL names another address. Local only: it refuses a hosted
 * Supabase, as the integration tests do, and sends no mail. Whatever it made
 * is deleted even when a step fails.
 *
 * Today is made through the feature functions, as the screens make it. What
 * no screen can make is written as the integration tests write it: the month
 * before today, put in place as it stood, and the morning's clock — today's
 * arrivals and moves set to the times of a morning, and the browser held at
 * 10:35 on the clinic's day — so the queue reads as a busy morning whatever
 * the hour the script runs.
 */
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { chromium, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";

const APP = process.env.LANDING_APP_URL ?? "http://localhost:3108";
const OUT = join(process.cwd(), "src/assets/landing");
const WORK = join(process.cwd(), ".landing-shots");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(supabaseUrl)) {
  throw new Error(
    `The landing shots are made only against a local Supabase, not ${supabaseUrl || "an unset address"}.`,
  );
}
// No mail: the owner's confirmation fails quietly, as it does when mail is down.
process.env.SMTP_HOST = "";

const { UI_TEXT } = await import("@/constants/messages");
const { PERMISSION_PRESET_SETS } = await import("@/constants/permissions");
const { REPORT_TAB_LABELS } = await import("@/constants/statuses");
const { addWalkIn, bookAppointment, markArrived } = await import("@/features/appointments/api");
const { markDone, markUrgent, sendIn } = await import("@/features/appointments/moves");
const { mobileHmac } = await import("@/features/auth/trial");
const { issueBill } = await import("@/features/billing/api");
const { recordPayment } = await import("@/features/billing/payments");
const { appointmentTypes, expenseCategories, services } = await import("@/features/clinic/catalogues");
const { createExpense } = await import("@/features/expenses/api");
const { addAlert } = await import("@/features/patients/alerts");
const { createPatient } = await import("@/features/patients/api");
const { savePrescription } = await import("@/features/prescriptions/records");
const { updateMember, updateOwnDoctor } = await import("@/features/team/members");
const { createTreatment } = await import("@/features/treatments/records");
const { saveVitals, updateVisit } = await import("@/features/visits/records");
const { addDaysKey, dayKey, dayTime, minutesOfDay, todayKey } = await import("@/lib/dates/calendar");
const validation = await import("@/lib/validation");
const { addMember, admin, registerClinic, removeAll } = await import("@tests/support/integration");

type Tenant = import("@/lib/supabase/tenant").Tenant;
type Method = "CASH" | "UPI" | "CARD" | "BANK_TRANSFER";

const today = todayKey();
const day = (offset: number) => addDaysKey(today, offset);
/** An instant on a day of the clinic's: `at(-3, "10:30")` is 10:30 three days ago, in India. */
const at = (offset: number, time: string) => dayTime(day(offset), time);
/** The clinic's clock as the photographs show it: mid-morning, today. */
const SCENE_CLOCK = at(0, "10:35");

/** A fixed run of chances (mulberry32), so every run makes the same month. */
function chances(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}
const chance = chances(2026);
const pickFrom = <T,>(items: readonly T[]): T => items[Math.floor(chance() * items.length)];

const OWNER = {
  fullName: "Maya Rao",
  email: `demo-${randomUUID().slice(0, 8)}@clinicdesk.test`,
  password: `Demo-${randomUUID()}`,
};

const DOCTORS = {
  maya: {
    specialization: "General Physician",
    qualifications: "MBBS, MD (General Medicine)",
    registrationNumber: "TCMC 48213",
    fee: "500",
  },
  arjun: {
    specialization: "Family Physician",
    qualifications: "MBBS, DNB (Family Medicine)",
    registrationNumber: "TCMC 61057",
    fee: "400",
  },
} as const;
type DoctorKey = keyof typeof DOCTORS;

/** Everyone the clinic has seen, and when they were born, as the add sheet takes it: an age. */
const PATIENTS = {
  // This morning's.
  kavya: { name: "Kavya Reddy", age: 29, gender: "FEMALE" },
  suresh: { name: "Suresh Warrier", age: 58, gender: "MALE" },
  anjali: { name: "Anjali Raghavan", age: 34, gender: "FEMALE" },
  rohan: { name: "Rohan Mehta", age: 42, gender: "MALE" },
  ashraf: { name: "Mohammed Ashraf", age: 51, gender: "MALE" },
  priya: { name: "Priya Menon", age: 31, gender: "FEMALE" },
  deepak: { name: "Deepak Joshi", age: 63, gender: "MALE" },
  sneha: { name: "Sneha Kulkarni", age: 38, gender: "FEMALE" },
  ishaan: { name: "Ishaan Bose", age: 8, gender: "MALE" },
  // Due back: a treatment's next sitting, or a visit's follow-up.
  lakshmi: { name: "Lakshmi Iyer", age: 61, gender: "FEMALE" },
  arvind: { name: "Arvind Kumar", age: 45, gender: "MALE" },
  ananya: { name: "Ananya Das", age: 24, gender: "FEMALE" },
  harish: { name: "Harish Patel", age: 52, gender: "MALE" },
  george: { name: "George Thomas", age: 67, gender: "MALE" },
  fathima: { name: "Fathima Rasheed", age: 44, gender: "FEMALE" },
  vikram: { name: "Vikram Singh", age: 36, gender: "MALE" },
  // The rest of the month's; Abdul and Thomas still owe a little.
  abdul: { name: "Abdul Rahman", age: 60, gender: "MALE" },
  thomas: { name: "Thomas Antony", age: 71, gender: "MALE" },
  meera: { name: "Meera Iyengar", age: 47, gender: "FEMALE" },
  joseph: { name: "Joseph Mathew", age: 55, gender: "MALE" },
  divya: { name: "Divya Sharma", age: 27, gender: "FEMALE" },
  rahul: { name: "Rahul Verma", age: 33, gender: "MALE" },
  nisha: { name: "Nisha Varghese", age: 39, gender: "FEMALE" },
  sanjay: { name: "Sanjay Desai", age: 49, gender: "MALE" },
  pooja: { name: "Pooja Shetty", age: 22, gender: "FEMALE" },
  revathi: { name: "Revathi Menon", age: 36, gender: "FEMALE" },
  kiran: { name: "Kiran Shenoy", age: 30, gender: "MALE" },
  aditi: { name: "Aditi Bhat", age: 12, gender: "FEMALE" },
  manoj: { name: "Manoj Nambiar", age: 44, gender: "MALE" },
  farhan: { name: "Farhan Ali", age: 26, gender: "MALE" },
  shalini: { name: "Shalini Pillai", age: 41, gender: "FEMALE" },
  ravi: { name: "Ravi Chandran", age: 57, gender: "MALE" },
} as const;
type PatientKey = keyof typeof PATIENTS;

/** The price list beside Consultation, which is priced at Dr. Maya's fee. */
const PRICE_LIST = [
  { key: "cbc", name: "Complete blood count", category: "INVESTIGATION", price: "350" },
  { key: "rbs", name: "Random blood sugar", category: "INVESTIGATION", price: "100" },
  { key: "hba1c", name: "HbA1c", category: "INVESTIGATION", price: "550" },
  { key: "lipid", name: "Lipid profile", category: "INVESTIGATION", price: "650" },
  { key: "ecg", name: "ECG", category: "INVESTIGATION", price: "300" },
  { key: "nebulise", name: "Nebulisation", category: "PROCEDURE", price: "250" },
  { key: "dressing", name: "Wound dressing", category: "PROCEDURE", price: "300" },
  { key: "injection", name: "Injection", category: "PROCEDURE", price: "150" },
] as const;
type ServiceKey = (typeof PRICE_LIST)[number]["key"];

/**
 * This morning, as the clock shows it at 10:35: each one in the order they
 * arrived — so in their token's order — when booked, when they arrived, went
 * in and were done. Kavya is done and paid, Suresh done and To bill, Rohan is
 * with Dr. Maya, three wait (Priya urgent), and three are still to come.
 */
interface Morning {
  who: PatientKey;
  doctor?: DoctorKey;
  /** Booked for; none is a walk-in. */
  booked?: string;
  type?: "Consultation" | "Review";
  arrived?: string;
  in?: string;
  done?: string;
  urgent?: string;
}
const MORNING: Morning[] = [
  { who: "kavya", booked: "09:30", arrived: "09:22", in: "09:31", done: "09:47" },
  { who: "suresh", booked: "09:45", type: "Review", arrived: "09:41", in: "09:49", done: "10:06" },
  { who: "anjali", arrived: "09:55" },
  { who: "rohan", booked: "10:15", arrived: "10:08", in: "10:22" },
  { who: "ashraf", booked: "10:30", arrived: "10:21" },
  { who: "priya", arrived: "10:27", urgent: "10:28" },
  { who: "deepak", booked: "11:00", type: "Review" },
  { who: "sneha", booked: "11:30" },
  { who: "ishaan", doctor: "arjun", booked: "11:45" },
];

const TOMORROW: { who: PatientKey; doctor: DoctorKey; time: string; type: "Consultation" | "Review" }[] = [
  { who: "meera", doctor: "maya", time: "10:00", type: "Consultation" },
  { who: "thomas", doctor: "maya", time: "10:30", type: "Review" },
  { who: "aditi", doctor: "arjun", time: "11:00", type: "Consultation" },
];

/** A visit of the month before today, put in place as it stood, then billed and paid on its day. */
interface PastVisit {
  offset: number;
  time: string;
  who: PatientKey;
  doctor: DoctorKey;
  walkIn: boolean;
  type: "Consultation" | "Review";
  extras: ServiceKey[];
  method: Method;
  /** Rupees left owing on its bill. */
  owes?: number;
  followUpOn?: string;
}

/** Patients whose own visits are placed by hand, so their follow-ups stay open. */
const FOLLOWED: PatientKey[] = ["george", "fathima", "vikram"];

/** In the evening hours, clear of the morning's bookings. */
const FIXED_VISITS: PastVisit[] = [
  // Back today, and two overdue — each a visit's follow-up.
  {
    offset: -7,
    time: "17:10",
    who: "george",
    doctor: "maya",
    walkIn: false,
    type: "Consultation",
    extras: ["ecg"],
    method: "UPI",
    followUpOn: today,
  },
  {
    offset: -12,
    time: "17:40",
    who: "fathima",
    doctor: "maya",
    walkIn: true,
    type: "Consultation",
    extras: ["cbc"],
    method: "CASH",
    followUpOn: day(-2),
  },
  {
    offset: -9,
    time: "18:05",
    who: "vikram",
    doctor: "arjun",
    walkIn: false,
    type: "Consultation",
    extras: [],
    method: "UPI",
    followUpOn: day(-4),
  },
  // Still owing part of their bills.
  {
    offset: -3,
    time: "17:20",
    who: "abdul",
    doctor: "maya",
    walkIn: false,
    type: "Consultation",
    extras: ["ecg", "rbs"],
    method: "CASH",
    owes: 500,
  },
  {
    offset: -6,
    time: "18:30",
    who: "thomas",
    doctor: "maya",
    walkIn: true,
    type: "Consultation",
    extras: ["lipid", "hba1c"],
    method: "UPI",
    owes: 700,
  },
];

/** The thirty days before today: three to five visits a working day, Sundays closed, as the chances fall. */
function pastMonth(): PastVisit[] {
  const visits: PastVisit[] = [];
  const pool = (Object.keys(PATIENTS) as PatientKey[]).filter((key) => !FOLLOWED.includes(key));
  for (let offset = -30; offset <= -1; offset += 1) {
    const weekday = new Date(`${day(offset)}T12:00:00Z`).getUTCDay();
    if (weekday === 0) continue;
    const count = 3 + (chance() < 0.5 ? 1 : 0) + (weekday === 1 || weekday === 6 ? 1 : 0);
    const seen = new Set<PatientKey>(FIXED_VISITS.filter((fixed) => fixed.offset === offset).map(({ who }) => who));
    let minutes = 9 * 60 + 30;
    for (let index = 0; index < count; index += 1) {
      let who = pickFrom(pool);
      while (seen.has(who)) who = pickFrom(pool);
      seen.add(who);
      const review = chance() < 0.25;
      const roll = chance();
      const extras: ServiceKey[] = review
        ? []
        : roll < 0.5
          ? []
          : roll < 0.85
            ? [pickFrom(PRICE_LIST).key]
            : [pickFrom(PRICE_LIST.slice(0, 5)).key, pickFrom(PRICE_LIST.slice(5)).key];
      const method = chance();
      visits.push({
        offset,
        time: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
        who,
        doctor: chance() < 0.3 ? "arjun" : "maya",
        walkIn: chance() < 0.4,
        type: review ? "Review" : "Consultation",
        extras,
        method: method < 0.55 ? "UPI" : method < 0.95 ? "CASH" : "CARD",
      });
      minutes += 30 + 5 * Math.floor(chance() * 4);
    }
  }
  return [...visits, ...FIXED_VISITS].sort((a, b) => a.offset - b.offset || a.time.localeCompare(b.time));
}

/** Booked, never come, or called off — the month's appointments that made no visit. */
const MISSED: { offset: number; time: string; who: PatientKey; cancelled?: string }[] = [
  { offset: -19, time: "16:00", who: "farhan", cancelled: "Patient rescheduled" },
  { offset: -15, time: "15:30", who: "pooja" },
  { offset: -8, time: "16:15", who: "kiran" },
  { offset: -5, time: "15:45", who: "nisha", cancelled: "Unwell, will come next week" },
  { offset: -2, time: "16:30", who: "rahul" },
];

/** Seen the month before too, so this month counts them as returning. */
const EARLIER: { offset: number; who: PatientKey }[] = [
  { offset: -33, who: "rohan" },
  { offset: -36, who: "suresh" },
  { offset: -38, who: "lakshmi" },
  { offset: -41, who: "deepak" },
  { offset: -44, who: "meera" },
  { offset: -47, who: "joseph" },
];

/** The month's costs: rent and the assistant's salary at its start, supplies through it. */
const EXPENSES: [offset: number, category: string, description: string, rupees: string, method: Method][] = [
  [-30, "Rent", "Clinic rent", "9000", "BANK_TRANSFER"],
  [-29, "Salary", "Front desk assistant", "8500", "BANK_TRANSFER"],
  [-22, "Electricity", "Electricity bill", "2640", "UPI"],
  [-19, "Medicine", "Stock for the dispensary", "4200", "UPI"],
  [-16, "Supplies", "Gloves, syringes and cotton", "1850", "CASH"],
  [-12, "Maintenance", "AC service", "1200", "CASH"],
  [-9, "Supplies", "Printer paper and patient files", "640", "CASH"],
  [-6, "Medicine", "Stock top-up", "2400", "UPI"],
  [-3, "Equipment", "Pulse oximeter", "1750", "CARD"],
  [-1, "Other", "Drinking water cans", "360", "CASH"],
];

/** What the photographs open: the visit with the doctor now, and Kavya's paid bill. */
interface Made {
  clinicId: string;
  ownerPhone: string;
  visitId: string;
  billId: string;
}

/** Ids the steps share. */
interface Clinic {
  owner: Tenant;
  doctors: Record<DoctorKey, string>;
  types: Record<string, string>;
  categories: Record<string, string>;
  consultation: string;
  prices: Record<ServiceKey, { id: string; paise: number }>;
  patients: Record<PatientKey, string>;
}

const step = (what: string) => console.log(`· ${what}`);
const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};
const rupees = (paise: number) => String(paise / 100);

/** The clinic, its two doctors, its price list, and everyone in it. */
async function openClinic(made: Partial<Made>): Promise<Clinic> {
  step("Registering Sunrise Family Clinic");
  const clinic = await registerClinic({
    ...OWNER,
    seesPatients: true,
    clinicName: "Sunrise Family Clinic",
    clinicType: "GENERAL",
    city: "Kochi",
    address: "14/220 Sahodaran Ayyappan Road, Kadavanthra, Kochi 682020",
    clinicPhone: "0484 220 4415",
  });
  made.clinicId = clinic.clinicId;
  made.ownerPhone = clinic.owner.phone;
  const owner = clinic.owner.tenant;
  await updateOwnDoctor(owner, validation.ownDoctorSchema.parse({ doctor: DOCTORS.maya }));

  const arjun = await addMember(clinic.clinicId, {
    role: "DOCTOR",
    permissions: [...PERMISSION_PRESET_SETS.DOCTOR.permissions],
  });
  fail((await admin().from("profiles").update({ full_name: "Arjun Shah" }).eq("id", arjun.userId)).error);
  await updateMember(owner, arjun.memberId, validation.updateMemberSchema.parse({ doctor: DOCTORS.arjun }));

  const [{ data: doctors }, types, categories, priceList] = await Promise.all([
    admin().from("doctors").select("id, member_id").eq("clinic_id", clinic.clinicId),
    appointmentTypes.list(owner),
    expenseCategories.list(owner),
    services.list(owner),
  ]);
  const doctorOf = (memberId: string) => doctors!.find((doctor) => doctor.member_id === memberId)!.id as string;

  step("Pricing the price list");
  const consultation = priceList.find((service) => service.name === "Consultation")!.id;
  await services.change(owner, consultation, {
    details: validation.serviceSchema.parse({
      name: "Consultation",
      category: "CONSULTATION",
      price: DOCTORS.maya.fee,
    }),
  });
  const prices = {} as Clinic["prices"];
  for (const entry of PRICE_LIST) {
    const added = await services.add(owner, validation.serviceSchema.parse(entry));
    prices[entry.key] = { id: added.id, paise: added.pricePaise };
  }

  step("Adding the patients");
  const patients = {} as Clinic["patients"];
  for (const [key, person] of Object.entries(PATIENTS) as [PatientKey, (typeof PATIENTS)[PatientKey]][]) {
    const added = await createPatient(
      owner,
      validation.patientSchema.parse({
        fullName: person.name,
        phone: `9${String(Math.floor(chance() * 1e9)).padStart(9, "0")}`,
        born: { as: "AGE", years: String(person.age) },
        gender: person.gender,
      }),
      randomUUID(),
    );
    patients[key] = added.id;
  }

  return {
    owner,
    doctors: { maya: clinic.owner.session.membership!.doctorId!, arjun: doctorOf(arjun.memberId) },
    types: Object.fromEntries(types.map((type) => [type.name, type.id])),
    categories: Object.fromEntries(categories.map((category) => [category.name, category.id])),
    consultation,
    prices,
    patients,
  };
}

/** A bill for a visit: the doctor's fee and what else was done, nothing collected unless asked. */
function billFor(
  clinic: Clinic,
  visit: { patientId: string; visitId: string; doctor: DoctorKey; extras: readonly ServiceKey[] },
  collect: { on: false } | { on: true; amount: string; method: Method; reference: string } = { on: false },
) {
  return validation.billSchema.parse({
    patientId: visit.patientId,
    visitId: visit.visitId,
    appointmentId: null,
    lines: [
      {
        kind: "SERVICE",
        serviceId: clinic.consultation,
        treatmentId: null,
        quantity: 1,
        price: DOCTORS[visit.doctor].fee,
      },
      ...visit.extras.map((key) => ({
        kind: "SERVICE",
        serviceId: clinic.prices[key].id,
        treatmentId: null,
        quantity: 1,
        price: rupees(clinic.prices[key].paise),
      })),
    ],
    discount: { kind: "NONE" },
    notes: "",
    collect,
  });
}

/**
 * The thirty days before today and a few visits before them, as they stood: each
 * appointment and visit put in place, then — oldest first, so the bill
 * numbers run with the days — billed through the app and paid on its day.
 */
async function lookBack(clinic: Clinic, made: Partial<Made>) {
  step("Putting the month before today in place");
  const month = pastMonth();
  const appointments: Record<string, unknown>[] = [];
  const visits: Record<string, unknown>[] = [];
  const tokens = new Map<string, number>();
  for (const visit of month) {
    const appointmentId = randomUUID();
    const visitId = randomUUID();
    const arrived = at(visit.offset, visit.time);
    const started = new Date(Date.parse(arrived) + 6 * 60_000).toISOString();
    const done = new Date(Date.parse(started) + 14 * 60_000).toISOString();
    const queue = `${visit.offset}:${visit.doctor}`;
    tokens.set(queue, (tokens.get(queue) ?? 0) + 1);
    appointments.push({
      id: appointmentId,
      clinic_id: made.clinicId,
      patient_id: clinic.patients[visit.who],
      doctor_id: clinic.doctors[visit.doctor],
      appointment_type_id: clinic.types[visit.type],
      source: visit.walkIn ? "WALK_IN" : "BOOKED",
      status: "COMPLETED",
      scheduled_at: arrived,
      duration_minutes: 15,
      token_number: tokens.get(queue),
      arrived_at: arrived,
      started_at: started,
      completed_at: done,
      created_at: arrived,
    });
    visits.push({
      id: visitId,
      clinic_id: made.clinicId,
      patient_id: clinic.patients[visit.who],
      doctor_id: clinic.doctors[visit.doctor],
      appointment_id: appointmentId,
      status: "COMPLETED",
      started_at: started,
      completed_at: done,
      created_at: started,
      billing_status: "TO_BILL",
      follow_up_on: visit.followUpOn ?? null,
    });
    Object.assign(visit, { visitId });
  }
  for (const missed of MISSED) {
    const when = at(missed.offset, missed.time);
    appointments.push({
      clinic_id: made.clinicId,
      patient_id: clinic.patients[missed.who],
      doctor_id: clinic.doctors.maya,
      appointment_type_id: clinic.types.Consultation,
      source: "BOOKED",
      status: missed.cancelled ? "CANCELLED" : "NO_SHOW",
      scheduled_at: when,
      duration_minutes: 15,
      cancelled_at: missed.cancelled ? at(missed.offset - 1, "18:00") : null,
      cancel_reason: missed.cancelled ?? null,
      created_at: at(missed.offset - 2, "11:00"),
    });
  }
  for (const earlier of EARLIER) {
    const started = at(earlier.offset, "10:40");
    visits.push({
      clinic_id: made.clinicId,
      patient_id: clinic.patients[earlier.who],
      doctor_id: clinic.doctors.maya,
      status: "COMPLETED",
      started_at: started,
      completed_at: at(earlier.offset, "10:55"),
      created_at: started,
      billing_status: "NO_CHARGE",
      no_charge_reason: "REVIEW",
    });
  }
  fail((await admin().from("appointments").insert(appointments, { defaultToNull: false })).error);
  fail((await admin().from("visits").insert(visits, { defaultToNull: false })).error);

  step(`Billing and taking payment for ${month.length} visits`);
  for (const visit of month as (PastVisit & { visitId: string })[]) {
    const bill = billFor(clinic, { ...visit, patientId: clinic.patients[visit.who] });
    await issueBill(clinic.owner, bill, randomUUID());
    const total = bill.items.reduce((sum, item) => sum + item.unitPricePaise * item.quantity, 0);
    await recordPayment(
      clinic.owner,
      validation.paymentSchema.parse({
        patientId: clinic.patients[visit.who],
        kind: "PAYMENT",
        amount: rupees(total - (visit.owes ?? 0) * 100),
        paidOn: day(visit.offset),
        method: visit.method,
        reference: "",
        note: "",
      }),
      randomUUID(),
    );
  }

  step("Recording the month's expenses");
  for (const [offset, category, description, amount, method] of EXPENSES) {
    await createExpense(
      clinic.owner,
      validation.expenseSchema.parse({
        categoryId: clinic.categories[category],
        amount,
        day: day(offset),
        method,
        description,
      }),
      randomUUID(),
    );
  }
}

/** What a medicine line leaves blank. */
const LINE = { strength: "", dose: "", frequency: "", timing: "", durationDays: "", instructions: "" };
const NO_VITALS = {
  systolic: "",
  diastolic: "",
  pulse: "",
  temperatureF: "",
  spo2: "",
  respiratoryRate: "",
  weightKg: "",
  heightCm: "",
};

/** What a doctor records in a visit: vitals, notes and a prescription — and a follow-up, when given. */
async function record(
  owner: Tenant,
  visitId: string,
  {
    vitals,
    complaint,
    diagnosis,
    notes,
    medicines,
    advice,
    followUpOn,
  }: {
    vitals: Partial<typeof NO_VITALS>;
    complaint: string;
    diagnosis: string;
    notes: string;
    medicines: Partial<typeof LINE & { medicine: string }>[];
    advice: string;
    followUpOn?: string;
  },
) {
  await saveVitals(
    owner,
    { visitId },
    validation.saveVitalsSchema.parse({ vitals: { ...NO_VITALS, ...vitals }, seen: null }),
  );
  await updateVisit(
    owner,
    visitId,
    validation.visitChangeSchema.parse({
      section: "NOTES",
      changes: { complaint, diagnosis, notes },
      seen: { complaint: null, diagnosis: null, notes: null },
    }),
  );
  await savePrescription(
    owner,
    visitId,
    validation.savePrescriptionSchema.parse({
      prescription: { items: medicines.map((item) => ({ ...LINE, ...item })), advice, printDiagnosis: true },
      seen: null,
    }),
  );
  if (followUpOn) {
    await updateVisit(
      owner,
      visitId,
      validation.visitChangeSchema.parse({ section: "FOLLOW_UP", changes: { followUpOn }, seen: { followUpOn: null } }),
    );
  }
}

/** The clinic-local "HH:MM" of an instant. */
const clockOf = (instant: Date) => {
  const minutes = minutesOfDay(instant);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

/**
 * Books an appointment through the app: at its own time while that is still
 * ahead, else at a spare step after the morning — clear of every booking it
 * shows — set to its own time after. A booking is never made in the past, and
 * the photographs are of a morning.
 */
async function book(
  clinic: Clinic,
  {
    who,
    doctor,
    offset,
    time,
    type,
  }: { who: PatientKey; doctor: DoctorKey; offset: number; time: string; type: string },
  spare: number,
): Promise<string> {
  const wanted = at(offset, time);
  const ahead = Date.parse(wanted) >= Date.now() + 5 * 60_000;
  const firstSpare = Math.max(Math.ceil(Date.now() / 300_000) * 300_000 + 10 * 60_000, Date.parse(at(0, "12:00")));
  const slot = ahead ? new Date(wanted) : new Date(firstSpare + spare * 20 * 60_000);
  const [hour, minute] = clockOf(slot).split(":");
  const booked = await bookAppointment(
    clinic.owner,
    validation.bookingSchema.parse({
      patient: { mode: "FOUND", id: clinic.patients[who] },
      doctorId: clinic.doctors[doctor],
      date: dayKey(slot),
      time: { hour, minute },
      typeId: clinic.types[type],
      length: { choice: "15", other: "" },
      notes: "",
    }),
    randomUUID(),
  );
  if (!ahead) fail((await admin().from("appointments").update({ scheduled_at: wanted }).eq("id", booked.id)).error);
  return booked.id;
}

/** This morning, through the app's own moves, then set to the morning's times. */
async function thisMorning(clinic: Clinic, made: Partial<Made>) {
  step("Booking today and tomorrow");
  const ids = new Map<PatientKey, string>();
  let spare = 0;
  for (const visit of MORNING) {
    if (!visit.booked) continue;
    const doctor = visit.doctor ?? "maya";
    ids.set(
      visit.who,
      await book(
        clinic,
        { ...visit, doctor, offset: 0, time: visit.booked, type: visit.type ?? "Consultation" },
        spare++,
      ),
    );
  }
  for (const visit of TOMORROW) await book(clinic, { ...visit, offset: 1 }, spare++);

  step("Running the morning's queue");
  for (const visit of MORNING) {
    if (!visit.arrived) continue;
    if (visit.booked) {
      await markArrived(clinic.owner, ids.get(visit.who)!);
    } else {
      const walkIn = await addWalkIn(
        clinic.owner,
        validation.walkInSchema.parse({
          patient: { mode: "FOUND", id: clinic.patients[visit.who] },
          doctorId: clinic.doctors[visit.doctor ?? "maya"],
          typeId: clinic.types.Consultation,
        }),
        randomUUID(),
      );
      ids.set(visit.who, walkIn.id);
    }
  }

  const sentIn = async (who: PatientKey) =>
    (await sendIn(clinic.owner, validation.sendInSchema.parse({ appointmentId: ids.get(who)! }))).visitId;
  const done = (who: PatientKey) =>
    markDone(clinic.owner, validation.queueMoveSchema.parse({ appointmentId: ids.get(who)! }));

  const kavya = await sentIn("kavya");
  await record(clinic.owner, kavya, {
    vitals: { systolic: "112", diastolic: "74", pulse: "78", temperatureF: "98.4", spo2: "99", weightKg: "56" },
    complaint: "Tiredness and headaches for two weeks.",
    diagnosis: "Anaemia, suspected iron deficiency",
    notes: "Pale conjunctiva. CBC today.",
    medicines: [
      {
        medicine: "Ferrous ascorbate + folic acid",
        strength: "100 mg",
        dose: "1 tab",
        frequency: "1-0-0",
        timing: "AFTER_FOOD",
        durationDays: "30",
      },
    ],
    advice: "Iron-rich food: greens, dates, jaggery. Review with the CBC report.",
  });
  await done("kavya");
  const bill = await issueBill(
    clinic.owner,
    billFor(
      clinic,
      { patientId: clinic.patients.kavya, visitId: kavya, doctor: "maya", extras: ["cbc"] },
      {
        on: true,
        amount: "850",
        method: "UPI",
        reference: "",
      },
    ),
    randomUUID(),
  );
  made.billId = bill.billId;

  const suresh = await sentIn("suresh");
  await record(clinic.owner, suresh, {
    vitals: { systolic: "146", diastolic: "92", pulse: "80", weightKg: "81" },
    complaint: "BP review. Occasional morning headache.",
    diagnosis: "Essential hypertension",
    notes: "BP above target on amlodipine. Telmisartan added.",
    medicines: [
      {
        medicine: "Amlodipine",
        strength: "5 mg",
        dose: "1 tab",
        frequency: "1-0-0",
        timing: "AFTER_FOOD",
        durationDays: "30",
      },
      {
        medicine: "Telmisartan",
        strength: "40 mg",
        dose: "1 tab",
        frequency: "0-0-1",
        timing: "AFTER_FOOD",
        durationDays: "30",
      },
    ],
    advice: "Less salt. A 30-minute walk daily.",
  });
  await done("suresh");

  // Rohan, with Dr. Maya now: the visit the landing page shows.
  await addAlert(
    clinic.owner,
    clinic.patients.rohan,
    validation.alertSchema.parse({ kind: "ALLERGY", label: "Penicillin", note: "Rash and swelling" }),
  );
  await addAlert(
    clinic.owner,
    clinic.patients.rohan,
    validation.alertSchema.parse({ kind: "CONDITION", label: "Hypertension", note: "" }),
  );
  const rohan = await sentIn("rohan");
  await record(clinic.owner, rohan, {
    vitals: {
      systolic: "132",
      diastolic: "86",
      pulse: "96",
      temperatureF: "101.2",
      spo2: "97",
      respiratoryRate: "18",
      weightKg: "74",
      heightCm: "172",
    },
    complaint: "Fever, sore throat and body ache for three days. Dry cough since yesterday.",
    diagnosis: "Acute pharyngitis",
    notes: "Throat congested, tonsils enlarged, no exudate. Chest clear. Allergic to penicillin, so azithromycin.",
    medicines: [
      {
        medicine: "Azithromycin",
        strength: "500 mg",
        dose: "1 tab",
        frequency: "1-0-0",
        timing: "AFTER_FOOD",
        durationDays: "3",
      },
      {
        medicine: "Paracetamol",
        strength: "650 mg",
        dose: "1 tab",
        frequency: "SOS",
        timing: "AFTER_FOOD",
        durationDays: "3",
        instructions: "For fever above 100 °F",
      },
      {
        medicine: "Cetirizine",
        strength: "10 mg",
        dose: "1 tab",
        frequency: "0-0-1",
        timing: "BEDTIME",
        durationDays: "5",
      },
    ],
    advice:
      "Warm salt-water gargles three times a day. Plenty of fluids and rest. Come back if the fever lasts beyond three days.",
    followUpOn: day(5),
  });
  made.visitId = rohan;

  await markUrgent(clinic.owner, validation.urgentSchema.parse({ appointmentId: ids.get("priya")!, urgent: true }));

  step("Setting the morning's clock");
  for (const visit of MORNING) {
    if (!visit.arrived) continue;
    const id = ids.get(visit.who)!;
    const times = {
      ...(!visit.booked && { scheduled_at: at(0, visit.arrived), created_at: at(0, visit.arrived) }),
      arrived_at: at(0, visit.arrived),
      started_at: visit.in ? at(0, visit.in) : null,
      completed_at: visit.done ? at(0, visit.done) : null,
      urgent_at: visit.urgent ? at(0, visit.urgent) : null,
    };
    fail((await admin().from("appointments").update(times).eq("id", id)).error);
    if (visit.in) {
      fail(
        (
          await admin()
            .from("visits")
            .update({ started_at: times.started_at, created_at: times.started_at, completed_at: times.completed_at })
            .eq("appointment_id", id)
        ).error,
      );
    }
  }
}

/** Treatments due back today, and one later in the week, so Follow-ups has its rows. */
async function dueBack(clinic: Clinic) {
  step("Adding treatments and alerts");
  const treatments: [PatientKey, DoctorKey, string, "PLANNED" | "IN_PROGRESS", string][] = [
    ["lakshmi", "maya", "Diabetes care", "IN_PROGRESS", today],
    ["arvind", "maya", "Wound dressing, left foot", "IN_PROGRESS", today],
    ["ananya", "arjun", "Hepatitis B vaccine, dose 2", "PLANNED", today],
    ["harish", "maya", "Asthma care plan", "IN_PROGRESS", day(3)],
  ];
  for (const [who, doctor, name, start, nextDueOn] of treatments) {
    await createTreatment(
      clinic.owner,
      validation.newTreatmentSchema.parse({
        patientId: clinic.patients[who],
        visitId: null,
        doctorId: clinic.doctors[doctor],
        start,
        name,
        description: "",
        estimatedCost: "",
        note: "",
        nextDueOn,
      }),
    );
  }
  await addAlert(
    clinic.owner,
    clinic.patients.lakshmi,
    validation.alertSchema.parse({ kind: "CONDITION", label: "Type 2 diabetes", note: "" }),
  );
  await addAlert(
    clinic.owner,
    clinic.patients.deepak,
    validation.alertSchema.parse({ kind: "ALLERGY", label: "Sulfa drugs", note: "" }),
  );
}

/** Deletes the demo clinic, its people and the trial its owner's mobile claimed. */
async function remove(made: Partial<Made>) {
  step("Deleting the demo clinic and its people");
  await removeAll();
  // A claim outlives its clinic (plan §7.6); the demo's number is made up, so its claim goes too.
  if (made.ownerPhone) {
    const claim = mobileHmac(made.ownerPhone, process.env.TRIAL_CLAIM_SECRET ?? "");
    fail((await admin().from("trial_claims").delete().eq("mobile_hmac", claim)).error);
  }
  if (made.clinicId) {
    const { count } = await admin()
      .from("clinics")
      .select("id", { count: "exact", head: true })
      .eq("id", made.clinicId);
    if (count !== 0) throw new Error(`The demo clinic ${made.clinicId} is still there.`);
  }
}

/** A browser signed in as the owner, its clock held at the morning's. */
async function signedIn(browser: Browser, width: number, height: number, scale: number): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    timezoneId: "Asia/Kolkata",
    locale: "en-IN",
  });
  await context.clock.setFixedTime(new Date(SCENE_CLOCK));
  const answer = await context.request.post(`${APP}/api/auth/login`, {
    data: { identifier: OWNER.email, password: OWNER.password },
  });
  if (!answer.ok()) throw new Error(`The demo owner could not sign in to ${APP}: ${answer.status()}`);
  return context.newPage();
}

/** Waits for a screen to stand still: its reads in, nothing loading, its fonts drawn, its fades done. */
async function settle(page: Page, path?: string) {
  if (path) await page.goto(`${APP}${path}`);
  await page.waitForLoadState("networkidle");
  // Only what is in view: a section further down may wait to be scrolled to before it reads.
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('[aria-busy="true"]')].some((element) => {
        const box = element.getBoundingClientRect();
        return box.bottom > 0 && box.top < window.innerHeight;
      }),
    undefined,
    { timeout: 20_000 },
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    const fades = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(fades.map((animation) => animation.finished.catch(() => undefined)));
  });
  await page.waitForTimeout(800);
}

const THEMES = ["light", "dark"] as const;
const PHONE_SHOTS = ["queue", "appointments", "visit", "follow-ups", "bill", "reports"] as const;

/**
 * Where a picture came from, kept beside it (`<file>.webp.json`, Impeccable's
 * provenance sidecar): a screenshot of the app, never a generated image.
 */
function origin(name: string, theme: string): string {
  const screen = name === "desktop" ? "Home at 1440 × 900" : `the ${name} screen at 390 × 844, 2×`;
  return `Origin: a screenshot of the built app, not a generated image — ${screen}, ${theme} theme, of the made-up Sunrise Family Clinic, taken by scripts/landing-shots.mts.`;
}

async function photograph(made: Made) {
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });
  const paths: Record<(typeof PHONE_SHOTS)[number], string> = {
    queue: "/queue",
    appointments: "/appointments",
    visit: `/visits/${made.visitId}`,
    "follow-ups": "/follow-ups",
    bill: `/bills/${made.billId}`,
    reports: "/reports",
  };
  const browser = await chromium.launch();
  try {
    const phone = await signedIn(browser, 390, 844, 2);
    const desk = await signedIn(browser, 1440, 900, 1);
    for (const colorScheme of THEMES) {
      step(`Photographing the ${colorScheme} theme`);
      await phone.emulateMedia({ colorScheme });
      for (const name of PHONE_SHOTS) {
        await settle(phone, paths[name]);
        if (name === "reports") {
          // The month, scrolled down to its chart: each day's collected over its expenses, standing just above the tabs.
          await phone.getByRole("tab", { name: REPORT_TAB_LABELS.MONTHLY }).click();
          await settle(phone);
          const chart = await phone.getByRole("figure", { name: UI_TEXT.reports.byDay }).boundingBox();
          const tabBar = await phone.locator("[data-bottom-nav]").boundingBox();
          if (!chart || !tabBar) throw new Error("The monthly report has no chart to show.");
          // Clear of the Add button, which stands above the tabs.
          await phone.evaluate((by) => window.scrollBy(0, by), chart.y + chart.height - tabBar.y + 48);
          await settle(phone);
        }
        await phone.screenshot({ path: join(WORK, `${name}-${colorScheme}.png`) });
      }
      await desk.emulateMedia({ colorScheme });
      await settle(desk, "/home");
      await desk.screenshot({ path: join(WORK, `desktop-${colorScheme}.png`) });
    }
  } finally {
    await browser.close();
  }

  await mkdir(OUT, { recursive: true });
  for (const name of [...PHONE_SHOTS, "desktop"]) {
    for (const theme of THEMES) {
      const file = join(OUT, `${name}-${theme}.webp`);
      await sharp(join(WORK, `${name}-${theme}.png`))
        .webp({ quality: 80, effort: 6 })
        .toFile(file);
      const provenance = { prompt: origin(name, theme), createdAt: new Date().toISOString() };
      await writeFile(`${file}.json`, `${JSON.stringify(provenance, null, 2)}\n`);
    }
  }
  await rm(WORK, { recursive: true, force: true });
}

const made: Partial<Made> = {};
try {
  const clinic = await openClinic(made);
  await lookBack(clinic, made);
  await thisMorning(clinic, made);
  await dueBack(clinic);
  await photograph(made as Made);
  console.log(`Landing shots written to ${OUT}`);
} finally {
  await remove(made);
}
