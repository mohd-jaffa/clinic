import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PAGE_SIZE } from "@/constants/limits";
import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { listPatients } from "@/features/patients/api";
import { listPatientTimeline } from "@/features/patients/timeline";
import type { TimelineEntry } from "@/features/patients/types";
import { savePrescription } from "@/features/prescriptions/records";
import { finishVisit, startVisit } from "@/features/visits/records";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import { savePrescriptionSchema, walkInSchema } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * A patient's history and their last visit (plan §10.2, §10.3; R6.5, D225 –
 * D228), against the local Supabase: one list of their visits and the
 * appointments that have none, newest first, each part only for whoever may
 * see it, paged across both without a gap or a repeat; each visit with what
 * it found, its medicines, or that it holds nothing; and the day of the last
 * visit on the patients list for everyone who sees the patient.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = ["patients.view", "patients.create", "appointments.view", "appointments.create"];
const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];

let clinic: TestClinic;
let other: TestClinic;
let desk: Member;
let nurse: Member;
let reader: Member;
let doctorA: Member;
let doctorB: Member;
const doctors = { A: "", B: "" };
let consultation: string;
const rohan = { patientId: "", walkInId: "", firstVisit: "", secondVisit: "", comingId: "", cancelledId: "" };
let paged: string;

const doctorIdOf = async (memberId: string) =>
  (await admin().from("doctors").select("id").eq("member_id", memberId).single()).data!.id as string;

async function addPatient(name: string) {
  const { data, error } = await desk
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  return data.patient_id;
}

/** An appointment written as it stands, for a history to read. */
async function anAppointment(patientId: string, at: string, status: string, cancelReason: string | null = null) {
  const { data, error } = await admin()
    .from("appointments")
    .insert({
      clinic_id: clinic.clinicId,
      patient_id: patientId,
      doctor_id: doctors.A,
      source: "BOOKED",
      appointment_type_id: consultation,
      scheduled_at: at,
      duration_minutes: 15,
      status,
      cancel_reason: cancelReason,
      cancelled_at: cancelReason === null ? null : new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Which entry an entry is: its kind and id. */
const idOf = (entry: TimelineEntry) => {
  if ("visit" in entry) return `visit:${entry.visit.id}`;
  if ("appointment" in entry) return `appointment:${entry.appointment.id}`;
  return "bill" in entry ? `bill:${entry.bill.id}` : `payment:${entry.payment.id}`;
};
/** The day an entry is on: a visit's or an appointment's. */
const dayOf = (entry: TimelineEntry) =>
  "visit" in entry ? entry.visit.day : "appointment" in entry ? entry.appointment.day : null;

beforeAll(async () => {
  [clinic, other] = await Promise.all([
    registerClinic({ fullName: "Asha Menon" }),
    registerClinic({ fullName: "Kiran Rao" }),
  ]);
  [desk, nurse, reader, doctorA, doctorB] = await Promise.all([
    addMember(clinic.clinicId, { permissions: [...DESK, "appointments.edit"] }),
    addMember(clinic.clinicId, { permissions: CLINICAL }),
    addMember(clinic.clinicId, { permissions: ["patients.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: [...CLINICAL, "appointments.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: [...CLINICAL, "appointments.view"] }),
  ]);
  [doctors.A, doctors.B] = await Promise.all([doctorIdOf(doctorA.memberId), doctorIdOf(doctorB.memberId)]);
  await Promise.all([
    admin().from("doctors").update({ registration_number: "KMC 12345" }).eq("id", doctors.A),
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", doctorA.userId),
  ]);
  consultation = (
    await admin()
      .from("appointment_types")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .single()
  ).data!.id as string;

  // Rohan, Maya Rao's: cancelled yesterday; walked in today, seen and
  // prescribed for; then a visit from his profile, closed with nothing on it;
  // and booked again for next week.
  rohan.patientId = await addPatient("Rohan Mehta");
  await admin().from("patients").update({ assigned_doctor_id: doctors.A }).eq("id", rohan.patientId);
  rohan.cancelledId = await anAppointment(
    rohan.patientId,
    dayHour(addDaysKey(todayKey(), -1), 11),
    "CANCELLED",
    "Patient asked",
  );
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: rohan.patientId }, doctorId: doctors.A, typeId: consultation }),
    randomUUID(),
  );
  rohan.walkInId = arrival.id;
  rohan.firstVisit = (await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" })).visitId;
  await admin()
    .from("visits")
    .update({ complaint: "Toothache", diagnosis: "Dental caries" })
    .eq("id", rohan.firstVisit);
  const line = { strength: "", dose: "", frequency: "", timing: "", durationDays: "", instructions: "" };
  await savePrescription(
    doctorA.tenant!,
    rohan.firstVisit,
    savePrescriptionSchema.parse({
      prescription: {
        items: [
          { ...line, medicine: "Paracetamol" },
          { ...line, medicine: "Amoxicillin" },
        ],
        advice: "",
        printDiagnosis: false,
      },
      seen: null,
    }),
  );
  await markDone(desk.tenant!, { appointmentId: arrival.id });
  rohan.secondVisit = (await startVisit(doctorA.tenant!, { patientId: rohan.patientId, doctorId: doctors.A })).visitId;
  await finishVisit(doctorA.tenant!, rohan.secondVisit);
  rohan.comingId = await anAppointment(rohan.patientId, dayHour(addDaysKey(todayKey(), 7), 10), "SCHEDULED");

  // A patient with more history than a page: a visit at ten on each of the
  // last 15 days, and an appointment kept at nine on each of the last 10.
  paged = await addPatient("Sunil Nair");
  const visits = await admin()
    .from("visits")
    .insert(
      Array.from({ length: 15 }, (_, index) => {
        const at = dayHour(addDaysKey(todayKey(), -(index + 1)), 10);
        return {
          clinic_id: clinic.clinicId,
          patient_id: paged,
          doctor_id: doctors.A,
          status: "COMPLETED",
          started_at: at,
          completed_at: at,
          created_at: at,
          billing_status: "TO_BILL",
        };
      }),
    );
  if (visits.error) throw visits.error;
  for (let day = 1; day <= 10; day += 1) {
    await anAppointment(paged, dayHour(addDaysKey(todayKey(), -day), 9), "COMPLETED");
  }
});

afterAll(removeAll);

describe("a patient's history (plan §10.3, D225)", () => {
  it("puts the visits among the appointments that have none, newest first — the walk-in standing as its visit", async () => {
    const page = await listPatientTimeline(doctorA.tenant!, rohan.patientId);
    expect(page.items.map(idOf)).toEqual([
      `appointment:${rohan.comingId}`,
      `visit:${rohan.secondVisit}`,
      `visit:${rohan.firstVisit}`,
      `appointment:${rohan.cancelledId}`,
    ]);
    expect(page.nextCursor).toBeNull();
    expect(page.items[3]).toMatchObject({ appointment: { status: "CANCELLED", cancelReason: "Patient asked" } });
  });

  it("says what each visit found and its medicines in order, or that it holds nothing (D226)", async () => {
    const page = await listPatientTimeline(doctorA.tenant!, rohan.patientId);
    const [second, first] = page.items.filter((entry) => "visit" in entry).map((entry) => entry.visit);
    expect(first).toMatchObject({
      status: "COMPLETED",
      day: todayKey(),
      doctorName: "Maya Rao",
      finding: "Dental caries",
      medicines: ["Paracetamol", "Amoxicillin"],
      recorded: true,
    });
    expect(second).toMatchObject({ status: "COMPLETED", finding: null, medicines: [], recorded: false });
  });

  it("gives the visits alone to someone who sees visits, not appointments", async () => {
    const page = await listPatientTimeline(nurse.tenant!, rohan.patientId);
    expect(page.items.map(idOf)).toEqual([`visit:${rohan.secondVisit}`, `visit:${rohan.firstVisit}`]);
  });

  it("gives every appointment, the walk-in among them, to someone who sees no visits", async () => {
    const page = await listPatientTimeline(desk.tenant!, rohan.patientId);
    expect(page.items.map(idOf)).toEqual([
      `appointment:${rohan.comingId}`,
      `appointment:${rohan.walkInId}`,
      `appointment:${rohan.cancelledId}`,
    ]);
    expect(page.items[1]).toMatchObject({ appointment: { status: "COMPLETED" } });
  });

  it("gives nothing to someone who sees neither, nor to a doctor whose patient it is not (D3)", async () => {
    expect(await listPatientTimeline(reader.tenant!, rohan.patientId)).toEqual({ items: [], nextCursor: null });
    expect(await listPatientTimeline(doctorB.tenant!, rohan.patientId)).toEqual({ items: [], nextCursor: null });
  });

  it("pages across both parts without a gap or a repeat", async () => {
    const first = await listPatientTimeline(doctorA.tenant!, paged);
    expect(first.items).toHaveLength(PAGE_SIZE);
    expect(first.nextCursor).toBe("10.10.0.0");
    const [visits, appointments, bills, payments] = (first.nextCursor ?? "").split(".").map(Number);
    const second = await listPatientTimeline(doctorA.tenant!, paged, { visits, appointments, bills, payments });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();

    const all = [...first.items, ...second.items];
    expect(new Set(all.map(idOf)).size).toBe(25);
    // A visit at ten, then that day's appointment at nine, a day at a time.
    expect(all.slice(0, 4).map(dayOf)).toEqual([
      addDaysKey(todayKey(), -1),
      addDaysKey(todayKey(), -1),
      addDaysKey(todayKey(), -2),
      addDaysKey(todayKey(), -2),
    ]);
    expect(all.slice(0, 2).map((entry) => "visit" in entry)).toEqual([true, false]);
    expect(second.items.every((entry) => "visit" in entry)).toBe(true);
  });
});

describe("the patients list's last visit (plan §10.2, D228)", () => {
  const lastVisitOf = async (member: SignedIn, name: string) =>
    (await listPatients(member.tenant!, { search: name, tab: "ALL" })).items.find((patient) => patient.name === name)
      ?.lastVisitOn;

  it("is the day of the latest visit, for everyone who sees the patient — visits.view or not", async () => {
    expect(await lastVisitOf(reader, "Rohan Mehta")).toBe(todayKey());
    expect(await lastVisitOf(desk, "Sunil Nair")).toBe(addDaysKey(todayKey(), -1));
    expect(await lastVisitOf(doctorA, "Rohan Mehta")).toBe(todayKey());
  });

  it("is none for a patient never seen", async () => {
    await addPatient("Anu Varma");
    expect(await lastVisitOf(reader, "Anu Varma")).toBeNull();
  });

  it("is never told for a patient the caller may not see, whatever row is sent", async () => {
    const { data: row } = await admin()
      .from("patients")
      .select("*")
      .eq("id", rohan.patientId)
      .single<Record<string, unknown>>();
    for (const asker of [doctorB, other.owner]) {
      const { data } = await asker.tenant!.supabase.rpc("last_visit_on", { p_patient: row });
      expect(data ?? null).toBeNull();
    }
  });
});
