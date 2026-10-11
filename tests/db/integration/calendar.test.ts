import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listAppointments } from "@/features/appointments/api";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The calendar's read (plan §11.5; R5.3): the appointments of the days asked,
 * by time, each with its patient, its doctor's name and its type's, one
 * doctor's or every doctor's, cancelled ones too — read as the member, so a
 * doctor finds only their own patients'.
 */
type Member = SignedIn & { memberId: string };

let clinic: TestClinic;
let desk: Member;
let doctorA: Member;
let doctorB: Member;
const doctors = { A: "", B: "" };
const day = addDaysKey(todayKey(), 1);
const nextDay = addDaysKey(todayKey(), 2);

async function book(patientId: string, doctorId: string, date: string, hour: number, minutes = 15) {
  const { data: type } = await admin()
    .from("appointment_types")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("name", "Consultation")
    .single();
  const { data, error } = await desk
    .tenant!.supabase.rpc("create_appointment", {
      p_appointment: {
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_type_id: type!.id,
        scheduled_at: dayHour(date, hour),
        duration_minutes: minutes,
      },
      p_idempotency_key: randomUUID(),
    })
    .single<{ appointment_id: string }>();
  if (error) throw error;
  return data.appointment_id;
}

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

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, doctorA, doctorB] = await Promise.all([
    addMember(clinic.clinicId, {
      permissions: [
        "patients.view",
        "patients.create",
        "appointments.view",
        "appointments.create",
        "appointments.cancel",
      ],
    }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "appointments.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "appointments.view"] }),
  ]);
  const doctorIdOf = async (memberId: string) =>
    (await admin().from("doctors").select("id").eq("member_id", memberId).single()).data!.id as string;
  [doctors.A, doctors.B] = await Promise.all([doctorIdOf(doctorA.memberId), doctorIdOf(doctorB.memberId)]);

  const [rohan, anita, kiran] = await Promise.all([
    addPatient("Rohan Mehta"),
    addPatient("Anita Rao"),
    addPatient("Kiran Das"),
  ]);
  await book(anita, doctors.B, day, 11);
  await book(rohan, doctors.A, day, 9, 30);
  const cancelled = await book(kiran, doctors.A, day, 15);
  await desk.tenant!.supabase.rpc("change_appointment_status", {
    p_appointment_id: cancelled,
    p_status: "CANCELLED",
    p_reason: "Travelling",
  });
  await book(kiran, doctors.B, nextDay, 10);
});

afterAll(removeAll);

describe("listAppointments (plan §11.5)", () => {
  it("reads every doctor's day by time, each with its patient, doctor and type — the cancelled too", async () => {
    const found = await listAppointments(desk.tenant!, { from: day, to: day });
    expect(found.map((appointment) => [appointment.patientName, appointment.status])).toEqual([
      ["Rohan Mehta", "SCHEDULED"],
      ["Anita Rao", "SCHEDULED"],
      ["Kiran Das", "CANCELLED"],
    ]);
    expect(found[0]).toMatchObject({
      doctorId: doctors.A,
      doctorName: "Test doctor",
      typeName: "Consultation",
      source: "BOOKED",
      minutes: 30,
      day,
      token: null,
    });
    expect(found[0].patientNumber).toBeGreaterThanOrEqual(1001);
    expect(new Date(found[0].scheduledAt).getTime()).toBe(new Date(dayHour(day, 9)).getTime());
  });

  it("keeps to one doctor, and to the days asked", async () => {
    const week = await listAppointments(desk.tenant!, { from: day, to: nextDay, doctorId: doctors.B });
    expect(week.map((appointment) => [appointment.patientName, appointment.day])).toEqual([
      ["Anita Rao", day],
      ["Kiran Das", nextDay],
    ]);
  });

  it("lets a doctor find only their own patients' appointments — all of each one's (D3)", async () => {
    // Rohan and Kiran are Doctor A's; Kiran's appointment with Doctor B comes with them. Anita is not theirs.
    const theirs = await listAppointments(doctorA.tenant!, { from: day, to: nextDay });
    expect(theirs.map((appointment) => [appointment.patientName, appointment.doctorId])).toEqual([
      ["Rohan Mehta", doctors.A],
      ["Kiran Das", doctors.A],
      ["Kiran Das", doctors.B],
    ]);
    const others = await listAppointments(doctorB.tenant!, { from: day, to: nextDay });
    expect(others.map((appointment) => appointment.patientName)).toEqual(["Anita Rao", "Kiran Das", "Kiran Das"]);
  });
});
