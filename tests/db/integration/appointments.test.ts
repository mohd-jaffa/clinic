import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CLOSURE_APPOINTMENTS_SHOWN } from "@/constants/limits";
import type { Permission } from "@/constants/permissions";
import { addClosure, listClosureAppointments } from "@/features/clinic/closures";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
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
 * Appointments in the database itself (plan §11, §27.3; R5.1, D137 – D143),
 * each member going straight at it with their own token, as the routes will:
 * booking on the clinic's steps, never twice into one doctor's time, never in
 * the past, on a closed day, for an archived patient or with a doctor gone;
 * statuses moving only as the table says; tokens counted per doctor per day
 * and kept for the day; walk-ins; moving a booking; the doctor scope growing
 * with each appointment; a patient with appointments to come not archived;
 * the appointments on a closure's days; and nothing written while the clinic
 * is view-only.
 */
type Member = SignedIn & { memberId: string };
interface AppointmentRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  source: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  local_date: string;
  token_number: number | null;
  arrived_at: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  notes: string | null;
  created_by: string | null;
}

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "patients.edit",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "appointments.cancel",
];
const DOCTOR: Permission[] = ["patients.view", "appointments.view", "appointments.create", "appointments.edit"];

let clinic: TestClinic;
let other: TestClinic;
let desk: Member;
let editor: Member;
let viewer: Member;
let manager: Member;
let doctorA: Member;
let doctorB: Member;
let doctorC: Member;
let doctorD: Member;
const doctors: Record<"A" | "B" | "C" | "D", string> = { A: "", B: "", C: "", D: "" };
let consultation: string;
let review: string;

const today = todayKey();
/** An instant on a day so many days from today, at an hour and minute of the clinic's clock. */
const at = (days: number, hour: number, minute = 0) =>
  new Date(new Date(dayHour(addDaysKey(today, days), hour)).getTime() + minute * 60_000).toISOString();
const sameInstant = (a: string | null, b: string) => new Date(a!).getTime() === new Date(b).getTime();

const supabaseOf = (member: SignedIn) => member.tenant!.supabase;

const doctorIdOf = async (memberId: string) => {
  const { data } = await admin().from("doctors").select("id").eq("member_id", memberId).single();
  return data!.id as string;
};

async function addPatient(name: string): Promise<string> {
  const { data, error } = await supabaseOf(desk)
    .rpc("create_patient", {
      p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  return data.patient_id;
}

const book = (member: SignedIn, fields: Record<string, unknown>, key: string = randomUUID()) =>
  supabaseOf(member)
    .rpc("create_appointment", {
      p_appointment: { appointment_type_id: consultation, duration_minutes: 15, ...fields },
      p_idempotency_key: key,
    })
    .single<{ appointment_id: string; created: boolean }>();

async function booked(member: SignedIn, fields: Record<string, unknown>): Promise<string> {
  const { data, error } = await book(member, fields);
  if (error) throw error;
  return data.appointment_id;
}

const walkIn = (member: SignedIn, fields: Record<string, unknown>, key: string = randomUUID()) =>
  supabaseOf(member)
    .rpc("add_walk_in", { p_walk_in: { appointment_type_id: consultation, ...fields }, p_idempotency_key: key })
    .single<{ appointment_id: string; created: boolean }>();

const setStatus = (member: SignedIn, id: string, status: string, reason: string | null = null) =>
  supabaseOf(member)
    .rpc("change_appointment_status", { p_appointment_id: id, p_status: status, p_reason: reason })
    .maybeSingle<AppointmentRow>();

const arrive = (member: SignedIn, id: string) =>
  supabaseOf(member).rpc("mark_arrived", { p_appointment_id: id }).maybeSingle<AppointmentRow>();

const move = (member: SignedIn, id: string, changes: Record<string, unknown>) =>
  supabaseOf(member)
    .rpc("update_appointment", { p_appointment_id: id, p_changes: changes })
    .maybeSingle<AppointmentRow>();

async function row(id: string): Promise<AppointmentRow> {
  const { data } = await admin().from("appointments").select("*").eq("id", id).single<AppointmentRow>();
  return data!;
}

/**
 * An appointment written straight into the table, as setup only: today's,
 * whose time may already have passed, or a past day's left unmarked.
 */
async function place(patientId: string, doctorId: string, days: number, hour: number): Promise<string> {
  const { data, error } = await admin()
    .from("appointments")
    .insert({
      clinic_id: clinic.clinicId,
      patient_id: patientId,
      doctor_id: doctorId,
      source: "BOOKED",
      appointment_type_id: consultation,
      scheduled_at: at(days, hour),
      duration_minutes: 15,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

const archive = (member: SignedIn, patientId: string) =>
  supabaseOf(member)
    .from("patients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", patientId)
    .select("id")
    .maybeSingle();

beforeAll(async () => {
  [clinic, other] = await Promise.all([
    registerClinic({ fullName: "Asha Menon" }),
    registerClinic({ fullName: "Ravi Kumar" }),
  ]);
  [desk, editor, viewer, manager, doctorA, doctorB, doctorC, doctorD] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view", "appointments.edit"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view"] }),
    addMember(clinic.clinicId, { permissions: ["settings.manage"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: DOCTOR }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: DOCTOR }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: DOCTOR }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: DOCTOR }),
  ]);
  [doctors.A, doctors.B, doctors.C, doctors.D] = await Promise.all(
    [doctorA, doctorB, doctorC, doctorD].map((member) => doctorIdOf(member.memberId)),
  );
  const { data: types } = await admin().from("appointment_types").select("id, name").eq("clinic_id", clinic.clinicId);
  consultation = types!.find((type) => type.name === "Consultation")!.id as string;
  review = types!.find((type) => type.name === "Review")!.id as string;
});

afterAll(removeAll);

describe("booking (plan §11.1)", () => {
  it("books on a step, scheduled, its day in the clinic's timezone, by whom — once per key", async () => {
    const patient = await addPatient("Rohan Mehta");
    const key = randomUUID();
    const { data, error } = await book(
      desk,
      { patient_id: patient, doctor_id: doctors.A, scheduled_at: at(1, 10) },
      key,
    );
    expect(error).toBeNull();
    expect(data!.created).toBe(true);

    const appointment = await row(data!.appointment_id);
    expect(appointment).toMatchObject({
      source: "BOOKED",
      status: "SCHEDULED",
      local_date: addDaysKey(today, 1),
      duration_minutes: 15,
      token_number: null,
      created_by: desk.userId,
    });

    const again = await book(desk, { patient_id: patient, doctor_id: doctors.A, scheduled_at: at(1, 10) }, key);
    expect(again.data).toEqual({ appointment_id: data!.appointment_id, created: false });
  });

  it("refuses a booking into a doctor's time, naming the time; back-to-back, another doctor or a walk-in never clash", async () => {
    const [first, second] = await Promise.all([addPatient("Anita Rao"), addPatient("Kiran Das")]);
    await booked(desk, { patient_id: first, doctor_id: doctors.B, scheduled_at: at(1, 11), duration_minutes: 30 });

    const { error } = await book(desk, { patient_id: second, doctor_id: doctors.B, scheduled_at: at(1, 11, 15) });
    expect(error?.hint).toBe("APPOINTMENT_SLOT_TAKEN");
    const named = JSON.parse(error!.details) as { startsAt: string; endsAt: string };
    expect(sameInstant(named.startsAt, at(1, 11))).toBe(true);
    expect(sameInstant(named.endsAt, at(1, 11, 30))).toBe(true);

    await expect(
      booked(desk, { patient_id: second, doctor_id: doctors.B, scheduled_at: at(1, 11, 30) }),
    ).resolves.toBeTruthy();
    await expect(
      booked(desk, { patient_id: second, doctor_id: doctors.C, scheduled_at: at(1, 11, 15) }),
    ).resolves.toBeTruthy();
  });

  it("frees the time once the booking is cancelled, or the patient was a no-show", async () => {
    const [first, second, third] = await Promise.all([
      addPatient("Meena Iyer"),
      addPatient("Sunil Rao"),
      addPatient("Divya Shah"),
    ]);
    const cancelled = await booked(desk, { patient_id: first, doctor_id: doctors.B, scheduled_at: at(1, 14) });
    expect((await setStatus(desk, cancelled, "CANCELLED", "Patient asked")).error).toBeNull();
    const instead = await booked(desk, { patient_id: second, doctor_id: doctors.B, scheduled_at: at(1, 14) });

    expect((await setStatus(desk, instead, "NO_SHOW")).error).toBeNull();
    await expect(
      booked(desk, { patient_id: third, doctor_id: doctors.B, scheduled_at: at(1, 14, 5) }),
    ).resolves.toBeTruthy();
  });

  it("refuses a time already passed, or off the clinic's 5-minute steps", async () => {
    const patient = await addPatient("Farah Khan");
    const past = await book(desk, { patient_id: patient, doctor_id: doctors.A, scheduled_at: at(-1, 10) });
    expect(past.error?.hint).toBe("APPOINTMENT_IN_PAST");
    const offStep = await book(desk, { patient_id: patient, doctor_id: doctors.A, scheduled_at: at(1, 16, 2) });
    expect(offStep.error?.code).toBe("23514");
  });

  it("refuses a clinic holiday, and a doctor's own leave, naming why (D139)", async () => {
    const patient = await addPatient("Leela Nair");
    await addClosure(clinic.owner.tenant, {
      doctorId: null,
      startsOn: addDaysKey(today, 3),
      endsOn: addDaysKey(today, 3),
      reason: "Diwali",
    });
    await addClosure(clinic.owner.tenant, {
      doctorId: doctors.A,
      startsOn: addDaysKey(today, 4),
      endsOn: addDaysKey(today, 4),
      reason: "Conference",
    });

    const holiday = await book(desk, { patient_id: patient, doctor_id: doctors.B, scheduled_at: at(3, 10) });
    expect(holiday.error?.hint).toBe("APPOINTMENT_ON_CLOSED_DAY");
    expect(JSON.parse(holiday.error!.details)).toEqual({ reason: "Diwali", wholeClinic: true });
    const leave = await book(desk, { patient_id: patient, doctor_id: doctors.A, scheduled_at: at(4, 10) });
    expect(JSON.parse(leave.error!.details)).toEqual({ reason: "Conference", wholeClinic: false });
    await expect(
      booked(desk, { patient_id: patient, doctor_id: doctors.B, scheduled_at: at(4, 10) }),
    ).resolves.toBeTruthy();
  });

  it("refuses an archived patient, a doctor no longer active, and an archived type (D103)", async () => {
    const [archived, patient] = await Promise.all([addPatient("Gone Away"), addPatient("Still Here")]);
    expect((await archive(desk, archived)).data).not.toBeNull();
    const refused = await book(desk, { patient_id: archived, doctor_id: doctors.B, scheduled_at: at(2, 9) });
    expect(refused.error?.hint).toBe("PATIENT_ARCHIVED");

    await admin().from("doctors").update({ active: false }).eq("id", doctors.D);
    const inactive = await book(desk, { patient_id: patient, doctor_id: doctors.D, scheduled_at: at(2, 9) });
    expect(inactive.error?.hint).toBe("DOCTOR_INACTIVE");
    await admin().from("doctors").update({ active: true }).eq("id", doctors.D);

    const { data: type } = await admin()
      .from("appointment_types")
      .insert({ clinic_id: clinic.clinicId, name: "Old type", default_minutes: 20, active: false })
      .select("id")
      .single();
    const oldType = await book(desk, {
      patient_id: patient,
      doctor_id: doctors.B,
      scheduled_at: at(2, 9),
      appointment_type_id: type!.id,
    });
    expect(oldType.error?.hint).toBe("APPOINTMENT_TYPE_INACTIVE");
  });

  it("needs appointments.create, and a patient the caller may see", async () => {
    const patient = await addPatient("Not Theirs");
    const viewing = await book(viewer, { patient_id: patient, doctor_id: doctors.A, scheduled_at: at(2, 10) });
    expect(viewing.error?.hint).toBe("AUTH_PERMISSION_DENIED");
    // A doctor finds only their own patients (D3): one nobody has linked them to is not there.
    const unseen = await book(doctorA, { patient_id: patient, doctor_id: doctors.A, scheduled_at: at(2, 10) });
    expect(unseen.error?.hint).toBe("RECORD_NOT_FOUND");
    const unkeyed = await supabaseOf(desk).rpc("create_appointment", {
      p_appointment: { patient_id: patient, doctor_id: doctors.A, scheduled_at: at(2, 10) },
      p_idempotency_key: null,
    });
    expect(unkeyed.error?.hint).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });
});

describe("statuses (plan §11.2)", () => {
  it("confirms, schedules again and cancels with a reason, stamped; a cancelled one goes nowhere", async () => {
    const patient = await addPatient("Tara Joshi");
    const id = await booked(desk, { patient_id: patient, doctor_id: doctors.C, scheduled_at: at(2, 11) });

    expect((await setStatus(desk, id, "CONFIRMED")).data?.status).toBe("CONFIRMED");
    expect((await setStatus(desk, id, "SCHEDULED")).data?.status).toBe("SCHEDULED");
    expect((await setStatus(desk, id, "CANCELLED")).error?.hint).toBe("APPOINTMENT_CANCEL_REASON_REQUIRED");

    const { data: cancelled } = await setStatus(desk, id, "CANCELLED", "Patient travelling");
    expect(cancelled).toMatchObject({
      status: "CANCELLED",
      cancel_reason: "Patient travelling",
      cancelled_by: desk.userId,
    });
    expect(cancelled!.cancelled_at).not.toBeNull();
    expect((await setStatus(desk, id, "SCHEDULED")).error?.hint).toBe("APPOINTMENT_STATUS_NOT_ALLOWED");
  });

  it("needs appointments.cancel to cancel and appointments.edit for the rest", async () => {
    const patient = await addPatient("Arjun Pillai");
    const id = await booked(desk, { patient_id: patient, doctor_id: doctors.C, scheduled_at: at(2, 12) });
    expect((await setStatus(editor, id, "CONFIRMED")).data?.status).toBe("CONFIRMED");
    expect((await setStatus(editor, id, "CANCELLED", "No")).error?.hint).toBe("AUTH_PERMISSION_DENIED");
    expect((await setStatus(viewer, id, "SCHEDULED")).error?.hint).toBe("AUTH_PERMISSION_DENIED");
  });

  it("reaches arrived only through mark_arrived, and the queue's statuses not at all here", async () => {
    const patient = await addPatient("Isha Kapoor");
    const id = await booked(desk, { patient_id: patient, doctor_id: doctors.C, scheduled_at: at(2, 13) });
    for (const status of ["ARRIVED", "IN_PROGRESS", "COMPLETED", "LOST"]) {
      expect((await setStatus(desk, id, status)).error?.hint, status).toBe("APPOINTMENT_STATUS_NOT_ALLOWED");
    }
  });

  it("changes nothing more when the same change comes twice", async () => {
    const patient = await addPatient("Neha Sen");
    const id = await booked(desk, { patient_id: patient, doctor_id: doctors.C, scheduled_at: at(2, 14) });
    await setStatus(desk, id, "CANCELLED", "First reason");
    const { data, error } = await setStatus(desk, id, "CANCELLED", "Second reason");
    expect(error).toBeNull();
    expect(data?.cancel_reason).toBe("First reason");
  });
});

describe("arriving and tokens (plan §11.3; D138, D141, D143)", () => {
  it("gives each arrival the doctor's next token of the day, counted per doctor", async () => {
    const [first, second, third] = await Promise.all([
      addPatient("Token One"),
      addPatient("Token Two"),
      addPatient("Token Three"),
    ]);
    const [a, b, c] = await Promise.all([
      place(first, doctors.C, 0, 1),
      place(second, doctors.C, 0, 2),
      place(third, doctors.D, 0, 1),
    ]);
    const one = await arrive(desk, a);
    expect(one.data).toMatchObject({ status: "ARRIVED", token_number: 1 });
    expect(one.data!.arrived_at).not.toBeNull();
    expect((await arrive(desk, b)).data?.token_number).toBe(2);
    expect((await arrive(desk, c)).data?.token_number).toBe(1);
  });

  it("keeps a patient's token when they go back and arrive again that day; one who left is a no-show (D138, D141)", async () => {
    const [first, second] = await Promise.all([addPatient("Back Again"), addPatient("Next One")]);
    const id = await place(first, doctors.B, 0, 1);
    const token = (await arrive(desk, id)).data!.token_number;

    const back = await setStatus(desk, id, "SCHEDULED");
    expect(back.data).toMatchObject({ status: "SCHEDULED", token_number: token, arrived_at: null });
    expect((await arrive(desk, id)).data?.token_number).toBe(token);

    expect((await setStatus(desk, id, "NO_SHOW")).data).toMatchObject({ status: "NO_SHOW", token_number: token });
    expect((await arrive(desk, id)).data).toMatchObject({ status: "ARRIVED", token_number: token });

    // Arriving again took no new number: the next patient is the very next.
    expect((await arrive(desk, await place(second, doctors.B, 0, 2))).data?.token_number).toBe(token! + 1);
  });

  it("arrives a patient only on the appointment's own day (D143)", async () => {
    const patient = await addPatient("Too Early");
    const id = await booked(desk, { patient_id: patient, doctor_id: doctors.C, scheduled_at: at(1, 15) });
    expect((await arrive(desk, id)).error?.hint).toBe("APPOINTMENT_NOT_TODAY");
    const yesterday = await place(patient, doctors.C, -1, 15);
    expect((await arrive(desk, yesterday)).error?.hint).toBe("APPOINTMENT_NOT_TODAY");
  });

  it("gives the token back when the appointment moves to another day", async () => {
    const patient = await addPatient("Moved On");
    const id = await place(patient, doctors.C, 0, 3);
    await arrive(desk, id);
    await setStatus(desk, id, "SCHEDULED");
    const { data, error } = await move(desk, id, { scheduled_at: at(2, 15) });
    expect(error).toBeNull();
    expect(data).toMatchObject({ token_number: null, local_date: addDaysKey(today, 2) });
  });

  it("refuses an archived patient's arrival, and one with appointments.view alone", async () => {
    const patient = await addPatient("Archived Later");
    const id = await place(patient, doctors.C, 0, 4);
    expect((await arrive(viewer, id)).error?.hint).toBe("AUTH_PERMISSION_DENIED");
    await setStatus(desk, id, "NO_SHOW");
    expect((await archive(desk, patient)).data).not.toBeNull();
    expect((await arrive(desk, id)).error?.hint).toBe("PATIENT_ARCHIVED");
  });
});

describe("walk-ins (plan §11.3, D139)", () => {
  it("adds one arrived now, with the type's length and the next token, once per key; it holds no slot", async () => {
    const [booked1, walker] = await Promise.all([addPatient("Booked Now"), addPatient("Walked In")]);
    // A booked half hour the walk-ins below fall in: they hold no slot, so never clash with it.
    const step = Math.floor(Date.now() / 300_000) * 300_000;
    const { error: placed } = await admin()
      .from("appointments")
      .insert({
        clinic_id: clinic.clinicId,
        patient_id: booked1,
        doctor_id: doctors.A,
        source: "BOOKED",
        appointment_type_id: consultation,
        scheduled_at: new Date(step).toISOString(),
        duration_minutes: 30,
      });
    expect(placed).toBeNull();
    const key = randomUUID();
    const { data, error } = await walkIn(
      desk,
      { patient_id: walker, doctor_id: doctors.A, appointment_type_id: review },
      key,
    );
    expect(error).toBeNull();
    const added = await row(data!.appointment_id);
    expect(added).toMatchObject({ source: "WALK_IN", status: "ARRIVED", duration_minutes: 15, local_date: today });
    expect(added.token_number).toBeGreaterThan(0);
    expect(Math.abs(new Date(added.scheduled_at).getTime() - Date.now())).toBeLessThan(60_000);

    const again = await walkIn(desk, { patient_id: walker, doctor_id: doctors.A }, key);
    expect(again.data).toEqual({ appointment_id: data!.appointment_id, created: false });

    const next = await walkIn(desk, { patient_id: booked1, doctor_id: doctors.A });
    expect((await row(next.data!.appointment_id)).token_number).toBe(added.token_number! + 1);
  });

  it("is refused on the doctor's leave, like a booking", async () => {
    const patient = await addPatient("Closed Today");
    await addClosure(clinic.owner.tenant, {
      doctorId: doctors.D,
      startsOn: today,
      endsOn: today,
      reason: "Sick leave",
    });
    const { error } = await walkIn(desk, { patient_id: patient, doctor_id: doctors.D });
    expect(error?.hint).toBe("APPOINTMENT_ON_CLOSED_DAY");
    expect(
      (await walkIn(desk, { patient_id: patient, doctor_id: doctors.A, appointment_type_id: null })).error?.hint,
    ).toBe("APPOINTMENT_TYPE_INACTIVE");
    expect((await walkIn(viewer, { patient_id: patient, doctor_id: doctors.A })).error?.hint).toBe(
      "AUTH_PERMISSION_DENIED",
    );
    const unkeyed = await supabaseOf(desk).rpc("add_walk_in", {
      p_walk_in: { patient_id: patient, doctor_id: doctors.A, appointment_type_id: consultation },
      p_idempotency_key: null,
    });
    expect(unkeyed.error?.hint).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("never sends a walk-in back to scheduled; it may be a no-show", async () => {
    const patient = await addPatient("Left Early");
    const { data } = await walkIn(desk, { patient_id: patient, doctor_id: doctors.A });
    expect((await setStatus(desk, data!.appointment_id, "SCHEDULED")).error?.hint).toBe(
      "APPOINTMENT_STATUS_NOT_ALLOWED",
    );
    expect((await setStatus(desk, data!.appointment_id, "NO_SHOW")).data?.status).toBe("NO_SHOW");
  });
});

describe("moving a booking (plan §11.5, D142)", () => {
  it("moves it under every booking rule, and schedules a confirmed one moved again", async () => {
    const [patient, other1] = await Promise.all([addPatient("Will Move"), addPatient("In The Way")]);
    const id = await booked(desk, { patient_id: patient, doctor_id: doctors.B, scheduled_at: at(2, 10) });
    await booked(desk, { patient_id: other1, doctor_id: doctors.B, scheduled_at: at(2, 16) });
    await setStatus(desk, id, "CONFIRMED");

    const clash = await move(desk, id, { scheduled_at: at(2, 16) });
    expect(clash.error?.hint).toBe("APPOINTMENT_SLOT_TAKEN");
    expect((await move(desk, id, { scheduled_at: at(-1, 10) })).error?.hint).toBe("APPOINTMENT_IN_PAST");
    expect((await move(desk, id, { scheduled_at: at(3, 10) })).error?.hint).toBe("APPOINTMENT_ON_CLOSED_DAY");

    const { data } = await move(desk, id, { scheduled_at: at(2, 17), doctor_id: doctors.C });
    expect(data).toMatchObject({ status: "SCHEDULED", doctor_id: doctors.C });
    expect(sameInstant(data!.scheduled_at, at(2, 17))).toBe(true);
  });

  it("keeps a confirmed one confirmed when only its notes, length or type change", async () => {
    const patient = await addPatient("Stays Put");
    const id = await booked(desk, { patient_id: patient, doctor_id: doctors.B, scheduled_at: at(2, 18) });
    await setStatus(desk, id, "CONFIRMED");
    const { data } = await move(desk, id, {
      notes: "Bring the X-ray",
      duration_minutes: 30,
      appointment_type_id: review,
    });
    expect(data).toMatchObject({ status: "CONFIRMED", notes: "Bring the X-ray", duration_minutes: 30 });
  });

  it("moves only a booking not yet arrived, only its own fields, and with appointments.edit", async () => {
    const patient = await addPatient("Arrived Already");
    const id = await place(patient, doctors.B, 0, 6);
    await arrive(desk, id);
    expect((await move(desk, id, { scheduled_at: at(2, 19) })).error?.hint).toBe("APPOINTMENT_NOT_MOVABLE");
    expect((await move(desk, id, { notes: "Waiting outside" })).data?.notes).toBe("Waiting outside");
    expect((await move(desk, id, { patient_id: patient })).error?.code).toBe("22023");
    expect((await move(viewer, id, { notes: "x" })).error?.hint).toBe("AUTH_PERMISSION_DENIED");
  });
});

describe("who sees appointments (plan §27.3, D3)", () => {
  it("reads them with appointments.view, and none without it", async () => {
    const patient = await addPatient("Seen By Some");
    const id = await booked(desk, { patient_id: patient, doctor_id: doctors.C, scheduled_at: at(2, 9, 30) });
    const { data: seen } = await supabaseOf(viewer).from("appointments").select("id").eq("id", id);
    expect(seen).toHaveLength(1);
    const { data: unseen } = await supabaseOf(manager).from("appointments").select("id");
    expect(unseen).toEqual([]);
  });

  it("lets a doctor see a patient once booked with them, and only their own patients' appointments", async () => {
    const patient = await addPatient("New To Doctor");
    const { data: before } = await supabaseOf(doctorB).from("patients").select("id").eq("id", patient);
    expect(before).toEqual([]);

    const id = await booked(desk, { patient_id: patient, doctor_id: doctors.B, scheduled_at: at(5, 9) });
    const { data: after } = await supabaseOf(doctorB).from("patients").select("id").eq("id", patient);
    expect(after).toHaveLength(1);
    const { data: theirs } = await supabaseOf(doctorB).from("appointments").select("id").eq("id", id);
    expect(theirs).toHaveLength(1);
    const { data: notTheirs } = await supabaseOf(doctorA).from("appointments").select("id").eq("id", id);
    expect(notTheirs).toEqual([]);
    // Moved to another doctor, it adds them; the first keeps the patient.
    await move(desk, id, { doctor_id: doctors.A });
    const { data: moved } = await supabaseOf(doctorA).from("appointments").select("id").eq("id", id);
    expect(moved).toHaveLength(1);
    const { data: kept } = await supabaseOf(doctorB).from("patients").select("id").eq("id", patient);
    expect(kept).toHaveLength(1);
  });
});

describe("archiving a patient with appointments to come (D140)", () => {
  it("is refused, naming the first; once cancelled, archived; one left on a past day does not count", async () => {
    const patient = await addPatient("Has Plans");
    await place(patient, doctors.C, -2, 9);
    const later = await booked(desk, { patient_id: patient, doctor_id: doctors.C, scheduled_at: at(6, 10) });
    const sooner = await booked(desk, { patient_id: patient, doctor_id: doctors.C, scheduled_at: at(5, 10) });

    const { error } = await archive(desk, patient);
    expect(error?.hint).toBe("PATIENT_HAS_APPOINTMENTS");
    expect(sameInstant((JSON.parse(error!.details) as { scheduledAt: string }).scheduledAt, at(5, 10))).toBe(true);

    await setStatus(desk, sooner, "CANCELLED", "Moving away");
    await setStatus(desk, later, "CANCELLED", "Moving away");
    expect((await archive(desk, patient)).data).not.toBeNull();
  });
});

describe("the appointments on a closure's days (D87, D137)", () => {
  let first: string;
  let second: string;

  beforeAll(async () => {
    [first, second] = await Promise.all([addPatient("Asha Day Five"), addPatient("Bina Day Six")]);
    await booked(desk, { patient_id: first, doctor_id: doctors.C, scheduled_at: at(5, 11) });
    await booked(desk, { patient_id: second, doctor_id: doctors.B, scheduled_at: at(6, 9) });
    const cancelled = await booked(desk, { patient_id: second, doctor_id: doctors.C, scheduled_at: at(6, 12) });
    await setStatus(desk, cancelled, "CANCELLED", "Not coming");
  });

  const list = (member: SignedIn, doctorId: string | null, limit: number = CLOSURE_APPOINTMENTS_SHOWN) =>
    supabaseOf(member).rpc("closure_appointments", {
      p_doctor_id: doctorId,
      p_starts_on: addDaysKey(today, 5),
      p_ends_on: addDaysKey(today, 6),
      p_limit: limit,
    });

  it("lists those still to happen by time, with how many in all, each patient named to the owner", async () => {
    const listed = await listClosureAppointments(clinic.owner.tenant, {
      doctorId: null,
      startsOn: addDaysKey(today, 5),
      endsOn: addDaysKey(today, 6),
    });
    const names = listed.appointments.map((appointment) => appointment.patientName);
    expect(names).toContain("Asha Day Five");
    expect(names).toContain("Bina Day Six");
    expect(listed.total).toBe(listed.appointments.length);
    const times = listed.appointments.map((appointment) => new Date(appointment.scheduledAt).getTime());
    expect(times).toEqual([...times].sort((x, y) => x - y));
    expect(listed.appointments.every((appointment) => appointment.doctorName)).toBe(true);

    const { data } = await list(clinic.owner, null, 1);
    expect(data).toHaveLength(1);
    expect(data![0].total).toBe(listed.total);
  });

  it("names no patient to a member who may not see them, and keeps to the doctor's own for their leave", async () => {
    const { data: unnamed } = await list(manager, null);
    expect(unnamed!.length).toBeGreaterThan(0);
    expect(unnamed!.every((appointment: { patient_name: string | null }) => appointment.patient_name === null)).toBe(
      true,
    );

    const { data: leave } = await list(clinic.owner, doctors.B);
    expect(leave!.map((appointment: { patient_name: string }) => appointment.patient_name)).toContain("Bina Day Six");
    expect(leave!.map((appointment: { patient_name: string }) => appointment.patient_name)).not.toContain(
      "Asha Day Five",
    );
  });

  it("is settings.manage's", async () => {
    expect((await list(desk, null)).error?.hint).toBe("AUTH_PERMISSION_DENIED");
  });
});

describe("a view-only clinic (plan §7.3)", () => {
  it("books, adds and changes nothing", async () => {
    const { data: patient } = await supabaseOf(other.owner)
      .rpc("create_patient", {
        p_patient: { full_name: "Plan Ended", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    const { data: types } = await admin()
      .from("appointment_types")
      .select("id")
      .eq("clinic_id", other.clinicId)
      .eq("name", "Consultation")
      .single();
    const { data: ownDoctor } = await admin().from("doctors").select("id").eq("clinic_id", other.clinicId).single();
    const fields = { patient_id: patient!.patient_id, doctor_id: ownDoctor!.id, appointment_type_id: types!.id };
    const { data: appointment } = await supabaseOf(other.owner)
      .rpc("create_appointment", {
        p_appointment: { ...fields, scheduled_at: at(1, 10), duration_minutes: 15 },
        p_idempotency_key: randomUUID(),
      })
      .single<{ appointment_id: string }>();

    await setValidUntil(other.clinicId, addDaysKey(today, -400));
    const booking = await supabaseOf(other.owner).rpc("create_appointment", {
      p_appointment: { ...fields, scheduled_at: at(1, 11), duration_minutes: 15 },
      p_idempotency_key: randomUUID(),
    });
    expect(booking.error?.hint).toBe("CLINIC_PLAN_EXPIRED");
    const walking = await supabaseOf(other.owner).rpc("add_walk_in", {
      p_walk_in: fields,
      p_idempotency_key: randomUUID(),
    });
    expect(walking.error?.hint).toBe("CLINIC_PLAN_EXPIRED");
    const confirming = await supabaseOf(other.owner).rpc("change_appointment_status", {
      p_appointment_id: appointment!.appointment_id,
      p_status: "CONFIRMED",
    });
    expect(confirming.error?.hint).toBe("CLINIC_PLAN_EXPIRED");
    // Still read.
    const { data: read } = await supabaseOf(other.owner).from("appointments").select("id");
    expect(read).toHaveLength(1);
  });
});
