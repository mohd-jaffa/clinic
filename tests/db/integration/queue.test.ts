import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn, listQueue, markArrived } from "@/features/appointments/api";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { walkInSchema, type WalkInInput } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Walk-ins, arrivals and today's queue (plan §11.3, §11.4; R5.5, D168 – D175):
 * a walk-in added — with a new patient too — once per key, with the doctor's
 * next token, refused on a closed day; a booking marked arrived with its
 * token, on its own day only; each audited; and the queue — today's live
 * appointments and anyone still with a doctor from before, one doctor's or
 * all, read as the member so a doctor finds only their own patients'.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
];

let clinic: TestClinic;
let desk: Member;
let walker: Member;
let doctorA: Member;
let doctorB: Member;
const doctors = { A: "", B: "" };
let consultation: string;
const patients = { rohan: "", anita: "", kiran: "" };

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

/** Now — or a day either side — on the clinic's 5-minute steps: today's is always today, whatever the hour. */
const stepNow = (days = 0) => new Date(Math.floor(Date.now() / 300_000) * 300_000 + days * 86_400_000).toISOString();

/** An appointment put in place as it stood — today's, at now, unless told otherwise. */
async function placed(fields: Record<string, unknown>) {
  const { data, error } = await admin()
    .from("appointments")
    .insert({
      clinic_id: clinic.clinicId,
      source: "BOOKED",
      appointment_type_id: consultation,
      scheduled_at: stepNow(),
      duration_minutes: 15,
      ...fields,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** A walk-in as the sheet holds it, parsed as the route parses it. */
const walkIn = (overrides: Partial<WalkInInput> = {}) =>
  walkInSchema.parse({
    patient: { mode: "FOUND", id: patients.rohan },
    doctorId: doctors.A,
    typeId: consultation,
    ...overrides,
  });

const auditsOf = async (entityId: string) =>
  (await admin().from("audit_logs").select("action, changes").eq("entity_id", entityId).order("created_at")).data!;

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, walker, doctorA, doctorB] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view", "appointments.create"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "appointments.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "appointments.view"] }),
  ]);
  [doctors.A, doctors.B] = await Promise.all([doctorIdOf(doctorA.memberId), doctorIdOf(doctorB.memberId)]);
  consultation = (
    await admin()
      .from("appointment_types")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .single()
  ).data!.id as string;
  [patients.rohan, patients.anita, patients.kiran] = await Promise.all([
    addPatient("Rohan Mehta"),
    addPatient("Anita Rao"),
    addPatient("Kiran Das"),
  ]);
});

afterAll(removeAll);

describe("addWalkIn (plan §11.3, D171)", () => {
  it("adds a walk-in arrived now with the doctor's next token, once per key, audited with its token", async () => {
    const key = randomUUID();
    const first = await addWalkIn(desk.tenant!, walkIn(), key, "req_walk");
    expect(first).toMatchObject({ patientId: patients.rohan, doctorId: doctors.A, token: 1 });
    expect(await addWalkIn(desk.tenant!, walkIn(), key)).toEqual(first);
    const second = await addWalkIn(
      desk.tenant!,
      walkIn({ patient: { mode: "FOUND", id: patients.anita } }),
      randomUUID(),
    );
    expect(second.token).toBe(2);

    const { data: row } = await admin()
      .from("appointments")
      .select("source, status, arrived_at")
      .eq("id", first.id)
      .single();
    expect(row).toMatchObject({ source: "WALK_IN", status: "ARRIVED", arrived_at: expect.any(String) });
    const audits = await auditsOf(first.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "CREATE",
      changes: { doctor_id: { from: null, to: doctors.A }, token_number: { from: null, to: 1 } },
    });
  });

  it("adds a new patient with it, and keeps and names them when it is refused on a closed day (D139, D145)", async () => {
    const { error } = await admin().from("clinic_closures").insert({
      clinic_id: clinic.clinicId,
      doctor_id: doctors.B,
      starts_on: todayKey(),
      ends_on: todayKey(),
      reason: "Conference",
    });
    expect(error).toBeNull();
    const patientKey = randomUUID();
    const newPatient = {
      mode: "NEW" as const,
      fullName: "Meera Pillai",
      phone: "98765 43210",
      born: { as: "AGE", years: "34" },
      gender: "FEMALE",
    };
    const refusal = await addWalkIn(
      desk.tenant!,
      walkIn({ patient: newPatient, doctorId: doctors.B, patientKey }),
      randomUUID(),
    ).catch((failure: unknown) => failure);
    expect(refusal).toMatchObject({
      code: "APPOINTMENT_ON_CLOSED_DAY",
      details: { reason: "Conference", wholeClinic: false, patient: { name: "Meera Pillai" } },
    });

    const added = await addWalkIn(desk.tenant!, walkIn({ patient: newPatient, patientKey }), randomUUID());
    const { data: meera } = await admin()
      .from("patients")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("full_name", "Meera Pillai");
    expect(meera).toHaveLength(1);
    expect(added.patientId).toBe(meera![0].id);
  });

  it("needs patients.create for a new patient, and a key for them", async () => {
    const newPatient = {
      mode: "NEW" as const,
      fullName: "No Rights",
      phone: "98765 43210",
      born: { as: "AGE", years: "34" },
      gender: "FEMALE",
    };
    await expect(
      addWalkIn(walker.tenant!, walkIn({ patient: newPatient, patientKey: randomUUID() }), randomUUID()),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    await expect(addWalkIn(desk.tenant!, walkIn({ patient: newPatient }), randomUUID())).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REQUIRED",
    });
  });
});

describe("markArrived (plan §11.3, D143)", () => {
  it("arrives today's booking with the doctor's next token, audited with it", async () => {
    const id = await placed({ patient_id: patients.kiran, doctor_id: doctors.B });
    const arrival = await markArrived(desk.tenant!, id, "req_arrive");
    expect(arrival).toEqual({ id, patientId: patients.kiran, doctorId: doctors.B, token: 1 });
    expect((await auditsOf(id)).at(-1)).toEqual({
      action: "STATUS_CHANGE",
      changes: { status: { from: "SCHEDULED", to: "ARRIVED" }, token_number: { from: null, to: 1 } },
    });
  });

  it("arrives only on the appointment's own day, and needs appointments.edit", async () => {
    const tomorrow = await placed({
      patient_id: patients.kiran,
      doctor_id: doctors.A,
      scheduled_at: stepNow(1),
    });
    await expect(markArrived(desk.tenant!, tomorrow, "req")).rejects.toMatchObject({ code: "APPOINTMENT_NOT_TODAY" });
    const today = await placed({ patient_id: patients.anita, doctor_id: doctors.A, scheduled_at: stepNow() });
    await expect(markArrived(walker.tenant!, today)).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("listQueue (plan §11.4)", () => {
  let carried: string;
  let cancelled: string;

  beforeAll(async () => {
    const yesterday = addDaysKey(todayKey(), -1);
    carried = await placed({
      patient_id: patients.rohan,
      doctor_id: doctors.B,
      scheduled_at: stepNow(-1),
      status: "IN_PROGRESS",
      token_number: 9,
      arrived_at: stepNow(-1),
      started_at: stepNow(-1),
    });
    expect((await admin().from("appointments").select("local_date").eq("id", carried).single()).data!.local_date).toBe(
      yesterday,
    );
    cancelled = await placed({
      patient_id: patients.anita,
      doctor_id: doctors.A,
      status: "CANCELLED",
      cancel_reason: "Patient asked",
      cancelled_at: new Date().toISOString(),
    });
  });

  it("reads today's live appointments, and anyone still with a doctor from before — none cancelled, none tomorrow", async () => {
    const found = await listQueue(desk.tenant!, {});
    const ids = found.map(({ id }) => id);
    expect(ids).toContain(carried);
    expect(ids).not.toContain(cancelled);
    expect(found.every((appointment) => appointment.day === todayKey() || appointment.status === "IN_PROGRESS")).toBe(
      true,
    );
    const walked = found.find((appointment) => appointment.source === "WALK_IN" && appointment.token === 1)!;
    expect(walked).toMatchObject({ patientName: "Rohan Mehta", status: "ARRIVED", arrivedAt: expect.any(String) });
    expect(found.find(({ id }) => id === carried)).toMatchObject({ startedAt: expect.any(String), completedAt: null });
  });

  it("keeps to one doctor when asked", async () => {
    const theirs = await listQueue(desk.tenant!, { doctorId: doctors.B });
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((appointment) => appointment.doctorId === doctors.B)).toBe(true);
  });

  it("lets a doctor find only their own patients' (D3)", async () => {
    // Anita has only ever come to Doctor A; Doctor B finds none of hers.
    const all = await listQueue(desk.tenant!, {});
    const asB = await listQueue(doctorB.tenant!, {});
    expect(all.some((appointment) => appointment.patientName === "Anita Rao")).toBe(true);
    expect(asB.some((appointment) => appointment.patientName === "Anita Rao")).toBe(false);
    expect(asB.map(({ id }) => id)).toContain(carried);
  });
});
