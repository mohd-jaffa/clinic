import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn, bookAppointment, changeAppointment, markArrived } from "@/features/appointments/api";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import { appointmentChangeSchema, bookingSchema, walkInSchema } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Requests that arrive at the same moment (plan §34.1; R5.6, D176): many
 * front desks booking one doctor's time at once, two moves into one slot,
 * arrivals and walk-ins for one doctor at once, and the same booking or
 * walk-in sent twice at once. Each request is its own transaction through
 * PostgREST, so the database alone keeps them apart — the exclusion
 * constraint (D7), the token counter's row lock (§11.3), the idempotency
 * key's advisory lock (§26) — never a read before the write.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
];
const AT_ONCE = 10;

let clinic: TestClinic;
let desks: Member[];
let doctorA: Member;
let doctorB: Member;
const doctors = { A: "", B: "" };
let consultation: string;
let patients: string[];

const tomorrow = addDaysKey(todayKey(), 1);

/** Each of `count` requests, made by the desks in turn and all sent at once, settled as they come back. */
const atOnce = <T>(count: number, request: (desk: Member, index: number) => Promise<T>) =>
  Promise.allSettled(Array.from({ length: count }, (_, index) => request(desks[index % desks.length], index)));

const doctorIdOf = async (memberId: string) =>
  (await admin().from("doctors").select("id").eq("member_id", memberId).single()).data!.id as string;

/** A booking for tomorrow, as the sheet holds it and the route parses it. */
const booking = (patientId: string, doctorId: string, hour: string, minute: string, length = "15") =>
  bookingSchema.parse({
    patient: { mode: "FOUND", id: patientId },
    doctorId,
    date: tomorrow,
    time: { hour, minute },
    typeId: consultation,
    length: { choice: length, other: "" },
    notes: "",
  });

/** The doctor's live bookings tomorrow, by time: when each starts and ends. */
async function bookedTomorrow(doctorId: string) {
  const { data } = await admin()
    .from("appointments")
    .select("id, scheduled_at, duration_minutes")
    .eq("doctor_id", doctorId)
    .eq("local_date", tomorrow)
    .eq("source", "BOOKED")
    .not("status", "in", "(CANCELLED,NO_SHOW)")
    .order("scheduled_at");
  return data!.map((row) => {
    const start = Date.parse(row.scheduled_at as string);
    return { id: row.id as string, start, end: start + (row.duration_minutes as number) * 60_000 };
  });
}

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  const members = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view"] }),
  ]);
  desks = members.slice(0, 3);
  [doctorA, doctorB] = members.slice(3);
  [doctors.A, doctors.B] = await Promise.all([doctorIdOf(doctorA.memberId), doctorIdOf(doctorB.memberId)]);
  consultation = (
    await admin()
      .from("appointment_types")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .single()
  ).data!.id as string;
  patients = await Promise.all(
    Array.from({ length: AT_ONCE + 4 }, async (_, index) => {
      const { data, error } = await desks[0]
        .tenant!.supabase.rpc("create_patient", {
          p_patient: {
            full_name: `Patient ${index + 1}`,
            phone: "+919876543210",
            date_of_birth: "1990-04-12",
            gender: "FEMALE",
          },
          p_idempotency_key: randomUUID(),
        })
        .single<{ patient_id: string }>();
      if (error) throw error;
      return data.patient_id;
    }),
  );
});

afterAll(removeAll);

describe("bookings at once (plan §11.1, D7)", () => {
  it("books exactly one of ten desks booking the same time, and tells every other that it is taken", async () => {
    const results = await atOnce(AT_ONCE, (desk, index) =>
      bookAppointment(desk.tenant!, booking(patients[index], doctors.A, "10", "00"), randomUUID()),
    );
    const booked = results.filter((result) => result.status === "fulfilled");
    const refused = results.filter((result) => result.status === "rejected");
    expect(booked).toHaveLength(1);
    expect(refused).toHaveLength(AT_ONCE - 1);
    for (const refusal of refused) {
      expect(refusal.reason).toMatchObject({
        code: "APPOINTMENT_SLOT_TAKEN",
        details: { startsAt: expect.any(String), endsAt: expect.any(String) },
      });
    }
    expect(await bookedTomorrow(doctors.A)).toHaveLength(1);
  });

  it("leaves no two overlapping when overlapping times, not all alike, are booked at once — each refusal naming one that stands", async () => {
    // 2:00 – 2:30, 2:15 – 2:45, 2:30 – 3:00 …: each overlaps the next, so which stand depends on who comes first.
    const starts = Array.from({ length: AT_ONCE }, (_, index) => 14 * 60 + index * 15);
    const results = await atOnce(AT_ONCE, (desk, index) =>
      bookAppointment(
        desk.tenant!,
        booking(
          patients[index],
          doctors.B,
          String(Math.floor(starts[index] / 60)).padStart(2, "0"),
          String(starts[index] % 60).padStart(2, "0"),
          "30",
        ),
        randomUUID(),
      ),
    );
    const standing = await bookedTomorrow(doctors.B);
    // However they fall, each one standing blocks at most the one before and the one after it.
    expect(standing.length).toBeGreaterThanOrEqual(Math.ceil(AT_ONCE / 3));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(standing.length);
    for (let index = 1; index < standing.length; index++) {
      expect(standing[index].start).toBeGreaterThanOrEqual(standing[index - 1].end);
    }
    for (const result of results) {
      if (result.status === "fulfilled") continue;
      const { startsAt, endsAt } = (result.reason as { details: { startsAt: string; endsAt: string } }).details;
      expect(standing).toContainEqual(
        expect.objectContaining({ start: Date.parse(startsAt), end: Date.parse(endsAt) }),
      );
    }
  });

  it("makes one booking of the same booking sent twice at once, under one key", async () => {
    const key = randomUUID();
    const same = booking(patients[AT_ONCE], doctors.A, "16", "00");
    const [first, second] = await Promise.all([
      bookAppointment(desks[0].tenant!, same, key),
      bookAppointment(desks[1].tenant!, same, key),
    ]);
    expect(second.id).toBe(first.id);
    const { data } = await admin().from("appointments").select("id").eq("idempotency_key", key);
    expect(data).toHaveLength(1);
    const { data: audits } = await admin().from("audit_logs").select("id").eq("entity_id", first.id);
    expect(audits).toHaveLength(1);
  });

  it("moves exactly one of two bookings moved into the same time at once", async () => {
    const [nine, half] = await Promise.all([
      bookAppointment(desks[0].tenant!, booking(patients[AT_ONCE + 1], doctors.A, "08", "00"), randomUUID()),
      bookAppointment(desks[1].tenant!, booking(patients[AT_ONCE + 2], doctors.A, "08", "30"), randomUUID()),
    ]);
    const toEleven = appointmentChangeSchema.parse({
      doctorId: doctors.A,
      date: tomorrow,
      time: { hour: "11", minute: "00" },
      typeId: consultation,
      length: { choice: "15", other: "" },
      notes: "",
    });
    const results = await Promise.allSettled([
      changeAppointment(desks[0].tenant!, nine.id, toEleven),
      changeAppointment(desks[1].tenant!, half.id, toEleven),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "APPOINTMENT_SLOT_TAKEN" },
    });
    const eleven = Date.parse(dayHour(tomorrow, 11));
    expect((await bookedTomorrow(doctors.A)).filter((slot) => slot.start === eleven)).toHaveLength(1);
  });
});

describe("tokens at once (plan §11.3, D141)", () => {
  /** Today's bookings for a doctor, a quarter apart from an hour on, put in place as they stood. */
  async function bookedToday(doctorId: string, patientIds: readonly string[], fromHour = 6) {
    const { data, error } = await admin()
      .from("appointments")
      .insert(
        patientIds.map((patientId, index) => ({
          clinic_id: clinic.clinicId,
          patient_id: patientId,
          doctor_id: doctorId,
          source: "BOOKED",
          appointment_type_id: consultation,
          scheduled_at: new Date(Date.parse(dayHour(todayKey(), fromHour)) + index * 15 * 60_000).toISOString(),
          duration_minutes: 15,
        })),
      )
      .select("id");
    if (error) throw error;
    return data.map((row) => row.id as string);
  }

  const walkIn = (patientId: string, doctorId: string) =>
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultation });

  it("numbers ten arrivals and walk-ins for one doctor at once 1 to 10 — none twice, none skipped — and another doctor's apart", async () => {
    const arriving = await bookedToday(doctors.A, patients.slice(0, 6));
    const otherDoctor = await bookedToday(doctors.B, patients.slice(6, 8));
    const requests: (() => Promise<{ doctorId: string; token: number }>)[] = [
      ...arriving.map((id, index) => () => markArrived(desks[index % desks.length].tenant!, id)),
      ...patients
        .slice(6, 10)
        .map(
          (patientId, index) => () =>
            addWalkIn(desks[index % desks.length].tenant!, walkIn(patientId, doctors.A), randomUUID()),
        ),
      ...otherDoctor.map((id) => () => markArrived(desks[0].tenant!, id)),
      () => addWalkIn(desks[1].tenant!, walkIn(patients[AT_ONCE], doctors.B), randomUUID()),
    ];
    const given = await Promise.all(requests.map((request) => request()));

    const tokensOf = (doctorId: string) =>
      given
        .filter((arrival) => arrival.doctorId === doctorId)
        .map(({ token }) => token)
        .sort((a, b) => a - b);
    expect(tokensOf(doctors.A)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(tokensOf(doctors.B)).toEqual([1, 2, 3]);
    const { data: counters } = await admin()
      .from("daily_tokens")
      .select("doctor_id, last_token")
      .eq("clinic_id", clinic.clinicId)
      .eq("day", todayKey());
    expect(Object.fromEntries(counters!.map((row) => [row.doctor_id, row.last_token]))).toEqual({
      [doctors.A]: 10,
      [doctors.B]: 3,
    });
  });

  it("gives one patient marked arrived twice at once one token, taken once", async () => {
    const [id] = await bookedToday(doctors.B, [patients[AT_ONCE + 3]], 18);
    const [first, second] = await Promise.all([markArrived(desks[0].tenant!, id), markArrived(desks[1].tenant!, id)]);
    expect(second.token).toBe(first.token);
    const { data: counter } = await admin()
      .from("daily_tokens")
      .select("last_token")
      .eq("doctor_id", doctors.B)
      .eq("day", todayKey())
      .single();
    expect(counter!.last_token).toBe(first.token);
  });

  it("adds one walk-in of the same walk-in sent twice at once, under one key, with one token", async () => {
    const key = randomUUID();
    const same = walkIn(patients[AT_ONCE + 1], doctors.B);
    const [first, second] = await Promise.all([
      addWalkIn(desks[0].tenant!, same, key),
      addWalkIn(desks[2].tenant!, same, key),
    ]);
    expect(second).toEqual(first);
    const { data } = await admin().from("appointments").select("token_number").eq("idempotency_key", key);
    expect(data).toEqual([{ token_number: first.token }]);
  });
});
