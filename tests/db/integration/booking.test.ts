import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { bookAppointment, listBookedTimes } from "@/features/appointments/api";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import { bookingSchema, type BookingInput } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Booking through the app (plan §11.1; R5.2, D144 – D151): the sheet's
 * booking as the route parses it and `bookAppointment` sends it — a patient
 * found, or a new one added with it, once each per key however often it is
 * sent; a new patient kept, and named, when the time is taken; the audit
 * rows; and a doctor's taken times on a day, for whoever books.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = ["patients.view", "patients.create", "appointments.view", "appointments.create"];

let clinic: TestClinic;
let desk: Member;
let booker: Member;
let doctorA: Member;
let doctorB: Member;
const doctors = { A: "", B: "" };
let consultation: string;
let patientId: string;

const tomorrow = addDaysKey(todayKey(), 1);

const doctorIdOf = async (memberId: string) => {
  const { data } = await admin().from("doctors").select("id").eq("member_id", memberId).single();
  return data!.id as string;
};

/** A booking as the sheet holds it, parsed as the route parses it. */
function booking(overrides: Partial<BookingInput> = {}) {
  return bookingSchema.parse({
    patient: { mode: "FOUND", id: patientId },
    doctorId: doctors.A,
    date: tomorrow,
    time: { hour: "10", minute: "00" },
    typeId: consultation,
    length: { choice: "15", other: "" },
    notes: "",
    ...overrides,
  });
}

const newPatient = (fullName: string) => ({
  mode: "NEW" as const,
  fullName,
  phone: "98765 43210",
  born: { as: "AGE", years: "34" },
  gender: "FEMALE",
});

const patientsNamed = async (name: string) => {
  const { data } = await admin().from("patients").select("id").eq("clinic_id", clinic.clinicId).eq("full_name", name);
  return data!;
};

const auditsOf = async (entityId: string) => {
  const { data } = await admin().from("audit_logs").select("action, changes, actor_id").eq("entity_id", entityId);
  return data!;
};

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, booker, doctorA, doctorB] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.create"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "appointments.create"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "appointments.view"] }),
  ]);
  [doctors.A, doctors.B] = await Promise.all([doctorIdOf(doctorA.memberId), doctorIdOf(doctorB.memberId)]);
  const { data: type } = await admin()
    .from("appointment_types")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("name", "Consultation")
    .single();
  consultation = type!.id as string;
  const { data, error } = await desk
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: "Rohan Mehta", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  patientId = data.patient_id;
});

afterAll(removeAll);

describe("bookAppointment (D144, D150)", () => {
  it("books a patient found, audits it once with its values and its notes by name, and books once per key", async () => {
    const key = randomUUID();
    const booked = await bookAppointment(desk.tenant!, booking({ notes: "Bring the X-ray" }), key, "req_book");
    expect(booked).toMatchObject({ patientId, scheduledAt: dayHour(tomorrow, 10), minutes: 15 });

    const again = await bookAppointment(desk.tenant!, booking({ notes: "Bring the X-ray" }), key);
    expect(again.id).toBe(booked.id);

    const audits = await auditsOf(booked.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "CREATE", actor_id: desk.userId });
    expect(audits[0].changes).toMatchObject({
      doctor_id: { from: null, to: doctors.A },
      duration_minutes: { from: null, to: 15 },
      fields: ["notes"],
    });
    expect(JSON.stringify(audits[0].changes)).not.toContain("X-ray");
  });

  it("says a time taken, naming it", async () => {
    await expect(
      bookAppointment(desk.tenant!, booking({ length: { choice: "30", other: "" } }), randomUUID()),
    ).rejects.toMatchObject({
      code: "APPOINTMENT_SLOT_TAKEN",
    });
  });
});

describe("a new patient booked with it (D145)", () => {
  it("adds the patient and books them, each once however often it is sent", async () => {
    const patientKey = randomUUID();
    const key = randomUUID();
    const input = booking({ patient: newPatient("Meera Pillai"), time: { hour: "11", minute: "00" }, patientKey });
    const booked = await bookAppointment(desk.tenant!, input, key, "req_new");
    const again = await bookAppointment(desk.tenant!, input, key);
    expect(again.id).toBe(booked.id);

    const added = await patientsNamed("Meera Pillai");
    expect(added).toHaveLength(1);
    expect(booked.patientId).toBe(added[0].id);
    const [audit] = await auditsOf(added[0].id);
    expect(audit).toMatchObject({ action: "CREATE" });
    expect(JSON.stringify(audit.changes)).not.toContain("Meera");
  });

  it("keeps a new patient added when the time is taken, names them, and adds no one twice when sent again", async () => {
    const patientKey = randomUUID();
    const taken = booking({ patient: newPatient("Kiran Das"), patientKey });
    const refusal = await bookAppointment(desk.tenant!, taken, randomUUID()).catch((failure: unknown) => failure);
    expect(refusal).toMatchObject({
      code: "APPOINTMENT_SLOT_TAKEN",
      details: { startsAt: expect.any(String), patient: { name: "Kiran Das", gender: "FEMALE" } },
    });
    const [kiran] = await patientsNamed("Kiran Das");
    expect((refusal as { details: { patient: { id: string } } }).details.patient.id).toBe(kiran.id);

    const instead = booking({ patient: newPatient("Kiran Das"), patientKey, time: { hour: "12", minute: "00" } });
    const booked = await bookAppointment(desk.tenant!, instead, randomUUID());
    expect(booked.patientId).toBe(kiran.id);
    expect(await patientsNamed("Kiran Das")).toHaveLength(1);
  });

  it("needs patients.create, and the new patient's own key", async () => {
    await expect(
      bookAppointment(
        booker.tenant!,
        booking({ patient: newPatient("No Rights"), patientKey: randomUUID() }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    await expect(
      bookAppointment(desk.tenant!, booking({ patient: newPatient("No Key") }), randomUUID()),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REQUIRED" });
    expect(await patientsNamed("No Rights")).toEqual([]);
  });
});

describe("listBookedTimes (D147)", () => {
  it("gives a doctor's taken times that day by time, live bookings only — never whose", async () => {
    const day = addDaysKey(todayKey(), 2);
    const at = (hour: number) => ({ date: day, time: { hour: String(hour).padStart(2, "0"), minute: "30" } });
    const later = await bookAppointment(desk.tenant!, booking({ ...at(15), doctorId: doctors.B }), randomUUID());
    await bookAppointment(
      desk.tenant!,
      booking({ ...at(9), doctorId: doctors.B, length: { choice: "45", other: "" } }),
      randomUUID(),
    );
    const cancelled = await bookAppointment(desk.tenant!, booking({ ...at(12), doctorId: doctors.B }), randomUUID());
    const { error } = await clinic.owner.tenant.supabase.rpc("change_appointment_status", {
      p_appointment_id: cancelled.id,
      p_status: "CANCELLED",
      p_reason: "Not coming",
    });
    expect(error).toBeNull();

    // A doctor who books sees another doctor's taken times, though not their patients.
    const times = await listBookedTimes(doctorA.tenant!, { doctorId: doctors.B, date: day });
    expect(times).toEqual([
      { startsAt: expect.any(String), endsAt: expect.any(String) },
      { startsAt: expect.any(String), endsAt: expect.any(String) },
    ]);
    expect(new Date(times[0].startsAt).getTime()).toBe(new Date(dayHour(day, 9)).getTime() + 30 * 60_000);
    expect(new Date(times[0].endsAt).getTime()).toBe(new Date(dayHour(day, 10)).getTime() + 15 * 60_000);
    expect(new Date(times[1].startsAt).getTime()).toBe(new Date(later.scheduledAt).getTime());
    expect(Object.keys(times[0])).toEqual(["startsAt", "endsAt"]);
  });

  it("is for whoever books or moves a booking", async () => {
    await expect(listBookedTimes(doctorB.tenant!, { doctorId: doctors.A, date: tomorrow })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});
