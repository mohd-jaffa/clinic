import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn, changeAppointmentStatus, getAppointment, listQueue } from "@/features/appointments/api";
import { backToWaiting, markDone, markSteppedOut, nextPatient, sendIn } from "@/features/appointments/moves";
import { getVisit } from "@/features/visits/api";
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
 * The queue's moves and the visit (plan §11.4, §12.1; R6.1, D192 – D198):
 * Send in opens the visit — asking what becomes of anyone already in — Done
 * closes it as To bill, Next patient finishes the one it is for and sends in
 * the lowest waiting token not stepped out, Back to waiting removes an empty
 * visit and keeps one with anything recorded. Each move is audited, each
 * twice changes nothing more, each needs appointments.edit; a visit is read
 * with visits.view, a doctor only their own patients'.
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
let watcher: Member;
let nurse: Member;
let doctorA: Member;
let doctorB: Member;
const doctors = { A: "", B: "" };
let consultation: string;

const doctorIdOf = async (memberId: string) =>
  (await admin().from("doctors").select("id").eq("member_id", memberId).single()).data!.id as string;

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

/** A patient walked in now to a doctor, waiting with the next token. */
async function waiting(name: string, doctorId = doctors.A) {
  const patientId = await addPatient(name);
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultation }),
    randomUUID(),
  );
  return { appointmentId: arrival.id, patientId, token: arrival.token };
}

const appointmentOf = async (id: string) =>
  (await admin().from("appointments").select("status, started_at, completed_at, stepped_out_at").eq("id", id).single())
    .data!;
const visitOf = async (appointmentId: string) =>
  (
    await admin()
      .from("visits")
      .select("id, status, completed_at, billing_status, doctor_id, visit_date")
      .eq("appointment_id", appointmentId)
      .maybeSingle()
  ).data;
const auditsOf = async (entityId: string) =>
  (
    await admin()
      .from("audit_logs")
      .select("action, entity_type, changes")
      .eq("entity_id", entityId)
      .order("created_at")
  ).data!;

/** Ends everyone still with a doctor, so each test starts with the rooms free. */
async function clearRooms() {
  await admin()
    .from("appointments")
    .update({ status: "CANCELLED", cancel_reason: "Test over", stepped_out_at: null })
    .eq("clinic_id", clinic.clinicId)
    .in("status", ["ARRIVED"]);
  const { data } = await admin()
    .from("appointments")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("status", "IN_PROGRESS");
  for (const { id } of data ?? []) await markDone(desk.tenant!, { appointmentId: id });
}

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, watcher, nurse, doctorA, doctorB] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view", "visits.view"] }),
    addMember(clinic.clinicId, {
      role: "DOCTOR",
      permissions: ["patients.view", "appointments.view", "appointments.edit", "visits.view"],
    }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "appointments.view", "visits.view"] }),
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
});

beforeEach(clearRooms);

afterAll(removeAll);

describe("sendIn (plan §11.4, D192)", () => {
  it("sends a waiting patient in and opens their visit on today, audited — twice changes nothing more", async () => {
    const asha = await waiting("Asha Iyer");
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: asha.appointmentId }, "req_in");

    expect(await appointmentOf(asha.appointmentId)).toMatchObject({
      status: "IN_PROGRESS",
      started_at: expect.any(String),
    });
    expect(await visitOf(asha.appointmentId)).toMatchObject({
      id: visitId,
      status: "OPEN",
      billing_status: null,
      doctor_id: doctors.A,
    });
    expect(await auditsOf(asha.appointmentId)).toContainEqual({
      action: "STATUS_CHANGE",
      entity_type: "appointments",
      changes: { status: { from: "ARRIVED", to: "IN_PROGRESS" } },
    });
    expect(await auditsOf(visitId)).toEqual([
      { action: "CREATE", entity_type: "visits", changes: { status: { from: null, to: "OPEN" } } },
    ]);

    expect(await sendIn(desk.tenant!, { appointmentId: asha.appointmentId })).toEqual({ visitId });
    expect(await auditsOf(visitId)).toHaveLength(1);
  });

  it("asks while the doctor has someone in: refused without a choice, the one in marked done, or both kept in", async () => {
    const [rahul, meena, kiran] = [
      await waiting("Rahul Shah"),
      await waiting("Meena Iyer"),
      await waiting("Kiran Das"),
    ];
    await sendIn(desk.tenant!, { appointmentId: rahul.appointmentId });

    await expect(sendIn(desk.tenant!, { appointmentId: meena.appointmentId })).rejects.toMatchObject({
      code: "DOCTOR_ROOM_TAKEN",
      kind: "CONFLICT",
    });
    expect((await appointmentOf(meena.appointmentId)).status).toBe("ARRIVED");

    await sendIn(desk.tenant!, { appointmentId: meena.appointmentId, others: "KEEP" });
    expect((await appointmentOf(rahul.appointmentId)).status).toBe("IN_PROGRESS");
    expect((await appointmentOf(meena.appointmentId)).status).toBe("IN_PROGRESS");

    await sendIn(desk.tenant!, { appointmentId: kiran.appointmentId, others: "FINISH" });
    expect((await appointmentOf(rahul.appointmentId)).status).toBe("COMPLETED");
    expect((await appointmentOf(meena.appointmentId)).status).toBe("COMPLETED");
    expect((await appointmentOf(kiran.appointmentId)).status).toBe("IN_PROGRESS");
    expect(await visitOf(rahul.appointmentId)).toMatchObject({ status: "COMPLETED", billing_status: "TO_BILL" });
  });

  it("never asks about another doctor's room", async () => {
    const withA = await waiting("Lata Pillai");
    const withB = await waiting("Vikram Sen", doctors.B);
    await sendIn(desk.tenant!, { appointmentId: withA.appointmentId });
    await sendIn(desk.tenant!, { appointmentId: withB.appointmentId });
    expect((await appointmentOf(withB.appointmentId)).status).toBe("IN_PROGRESS");
  });

  it("sends in only a waiting patient, and needs appointments.edit", async () => {
    const asha = await waiting("Sunita Rao");
    await changeAppointmentStatus(desk.tenant!, asha.appointmentId, { status: "NO_SHOW", reason: null });
    await expect(sendIn(desk.tenant!, { appointmentId: asha.appointmentId })).rejects.toMatchObject({
      code: "APPOINTMENT_STATUS_NOT_ALLOWED",
    });
    const other = await waiting("Divya Menon");
    await expect(sendIn(watcher.tenant!, { appointmentId: other.appointmentId })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});

describe("markDone (plan §11.4, D43)", () => {
  it("marks the patient in done and closes their visit as To bill, whatever was recorded — twice changes nothing more", async () => {
    const asha = await waiting("Asha Kapoor");
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: asha.appointmentId });
    await markDone(desk.tenant!, { appointmentId: asha.appointmentId }, "req_done");

    expect(await appointmentOf(asha.appointmentId)).toMatchObject({
      status: "COMPLETED",
      completed_at: expect.any(String),
    });
    expect(await visitOf(asha.appointmentId)).toMatchObject({
      status: "COMPLETED",
      billing_status: "TO_BILL",
      completed_at: expect.any(String),
    });
    expect((await auditsOf(visitId)).at(-1)).toEqual({
      action: "STATUS_CHANGE",
      entity_type: "visits",
      changes: { status: { from: "OPEN", to: "COMPLETED" }, billing_status: { from: null, to: "TO_BILL" } },
    });

    await markDone(desk.tenant!, { appointmentId: asha.appointmentId });
    expect(await auditsOf(visitId)).toHaveLength(2);
  });

  it("marks done only a patient in", async () => {
    const asha = await waiting("Neha Joshi");
    await expect(markDone(desk.tenant!, { appointmentId: asha.appointmentId })).rejects.toMatchObject({
      code: "APPOINTMENT_STATUS_NOT_ALLOWED",
    });
  });
});

describe("nextPatient (D193, D196, D198)", () => {
  it("finishes the patient it is for, then sends in the doctor's lowest waiting token not stepped out", async () => {
    const first = await waiting("Arjun Nair");
    const away = await waiting("Pooja Shah");
    const third = await waiting("Ravi Kumar");
    await sendIn(desk.tenant!, { appointmentId: first.appointmentId });
    await markSteppedOut(desk.tenant!, { appointmentId: away.appointmentId, out: true });

    const { sent } = await nextPatient(doctorA.tenant!, { doctorId: doctors.A, appointmentId: first.appointmentId });

    expect((await appointmentOf(first.appointmentId)).status).toBe("COMPLETED");
    expect(sent).toEqual({
      appointmentId: third.appointmentId,
      visitId: (await visitOf(third.appointmentId))!.id,
      token: third.token,
      patientName: "Ravi Kumar",
    });
    expect((await appointmentOf(away.appointmentId)).status).toBe("ARRIVED");
  });

  it("finishes only the patient it is for with two in, and sends no one more pressed twice for them", async () => {
    const [one, two, next] = [await waiting("Gita Bose"), await waiting("Hari Lal"), await waiting("Isha Roy")];
    await sendIn(desk.tenant!, { appointmentId: one.appointmentId });
    await sendIn(desk.tenant!, { appointmentId: two.appointmentId, others: "KEEP" });

    await nextPatient(desk.tenant!, { doctorId: doctors.A, appointmentId: one.appointmentId });
    expect((await appointmentOf(two.appointmentId)).status).toBe("IN_PROGRESS");
    expect((await appointmentOf(next.appointmentId)).status).toBe("IN_PROGRESS");

    expect(await nextPatient(desk.tenant!, { doctorId: doctors.A, appointmentId: one.appointmentId })).toEqual({
      sent: null,
    });
  });

  it("with the room free, sends in the lowest token once — pressed again it names who is in", async () => {
    const lowest = await waiting("Jaya Das");
    await waiting("Kunal Rao");
    const { sent } = await nextPatient(desk.tenant!, { doctorId: doctors.A });
    expect(sent).toMatchObject({ appointmentId: lowest.appointmentId, patientName: "Jaya Das" });

    const again = await nextPatient(desk.tenant!, { doctorId: doctors.A });
    expect(again.sent).toMatchObject({ appointmentId: lowest.appointmentId, visitId: sent!.visitId });
    const { data: inRoom } = await admin()
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("status", "IN_PROGRESS");
    expect(inRoom).toHaveLength(1);
  });

  it("closes the visit and sends no one when no one is waiting", async () => {
    const last = await waiting("Lina George");
    await sendIn(desk.tenant!, { appointmentId: last.appointmentId });
    expect(await nextPatient(desk.tenant!, { doctorId: doctors.A, appointmentId: last.appointmentId })).toEqual({
      sent: null,
    });
    expect(await visitOf(last.appointmentId)).toMatchObject({ status: "COMPLETED", billing_status: "TO_BILL" });
  });

  it("refuses another doctor's patient, and needs appointments.edit", async () => {
    const asha = await waiting("Mira Khan");
    await sendIn(desk.tenant!, { appointmentId: asha.appointmentId });
    await expect(
      nextPatient(desk.tenant!, { doctorId: doctors.B, appointmentId: asha.appointmentId }),
    ).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    await expect(nextPatient(doctorB.tenant!, { doctorId: doctors.A })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});

describe("backToWaiting (D197)", () => {
  it("puts the patient back with their token and removes an empty visit, so the booking can still be cancelled", async () => {
    const asha = await waiting("Nisha Paul");
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: asha.appointmentId });
    await backToWaiting(desk.tenant!, { appointmentId: asha.appointmentId });

    expect(await appointmentOf(asha.appointmentId)).toMatchObject({ status: "ARRIVED", started_at: null });
    expect(await visitOf(asha.appointmentId)).toBeNull();
    expect((await auditsOf(visitId)).at(-1)).toEqual({
      action: "DELETE",
      entity_type: "visits",
      changes: { status: { from: "OPEN", to: null } },
    });
    await changeAppointmentStatus(desk.tenant!, asha.appointmentId, { status: "NO_SHOW", reason: null });
    expect((await appointmentOf(asha.appointmentId)).status).toBe("NO_SHOW");
  });

  it("keeps a visit with anything recorded, continues it when sent in again, and lets the appointment end only with Done", async () => {
    const asha = await waiting("Omana Varghese");
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: asha.appointmentId });
    await admin().from("visits").update({ complaint: "Toothache, two days" }).eq("id", visitId);
    await backToWaiting(desk.tenant!, { appointmentId: asha.appointmentId });

    expect(await visitOf(asha.appointmentId)).toMatchObject({ id: visitId, status: "OPEN" });
    await expect(
      changeAppointmentStatus(desk.tenant!, asha.appointmentId, { status: "NO_SHOW", reason: null }),
    ).rejects.toMatchObject({ code: "APPOINTMENT_HAS_VISIT", kind: "BUSINESS_RULE" });
    expect(await sendIn(desk.tenant!, { appointmentId: asha.appointmentId })).toEqual({ visitId });
  });

  it("counts vitals as something recorded", async () => {
    const asha = await waiting("Padma Iyer");
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: asha.appointmentId });
    await admin().from("vitals").insert({
      clinic_id: clinic.clinicId,
      patient_id: asha.patientId,
      visit_id: visitId,
      pulse: 72,
    });
    await backToWaiting(desk.tenant!, { appointmentId: asha.appointmentId });
    expect(await visitOf(asha.appointmentId)).toMatchObject({ id: visitId });
  });
});

describe("markSteppedOut (D198)", () => {
  it("marks a waiting patient stepped out and back, audited, cleared when they are sent in", async () => {
    const asha = await waiting("Rekha Nair");
    const { steppedOutAt } = await markSteppedOut(desk.tenant!, { appointmentId: asha.appointmentId, out: true });
    expect(steppedOutAt).toEqual(expect.any(String));
    // Marked twice, it keeps when they first stepped out.
    expect(await markSteppedOut(desk.tenant!, { appointmentId: asha.appointmentId, out: true })).toEqual({
      steppedOutAt,
    });
    expect(await markSteppedOut(desk.tenant!, { appointmentId: asha.appointmentId, out: false })).toEqual({
      steppedOutAt: null,
    });
    const audits = (await auditsOf(asha.appointmentId)).filter((audit) => audit.action === "UPDATE");
    expect(audits.map((audit) => audit.changes)).toEqual([
      { stepped_out_at: { from: null, to: expect.any(String) } },
      { stepped_out_at: { from: expect.any(String), to: null } },
    ]);

    await markSteppedOut(desk.tenant!, { appointmentId: asha.appointmentId, out: true });
    await sendIn(desk.tenant!, { appointmentId: asha.appointmentId });
    expect((await appointmentOf(asha.appointmentId)).stepped_out_at).toBeNull();
  });

  it("only while waiting", async () => {
    const asha = await waiting("Shobha Das");
    await sendIn(desk.tenant!, { appointmentId: asha.appointmentId });
    await expect(markSteppedOut(desk.tenant!, { appointmentId: asha.appointmentId, out: true })).rejects.toMatchObject({
      code: "APPOINTMENT_STATUS_NOT_ALLOWED",
    });
  });
});

describe("getVisit (plan §12.2, D195)", () => {
  it("reads the header: patient, doctor, token, and their active alerts, allergies first", async () => {
    const asha = await waiting("Tara Menon");
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: asha.appointmentId });
    const { error } = await admin()
      .from("patient_alerts")
      .insert([
        { clinic_id: clinic.clinicId, patient_id: asha.patientId, kind: "CONDITION", label: "Diabetes", active: true },
        { clinic_id: clinic.clinicId, patient_id: asha.patientId, kind: "ALLERGY", label: "Penicillin", active: true },
        { clinic_id: clinic.clinicId, patient_id: asha.patientId, kind: "MEDICATION", label: "Old", active: false },
      ]);
    expect(error).toBeNull();

    const visit = await getVisit(nurse.tenant!, visitId);
    expect(visit).toMatchObject({
      id: visitId,
      status: "OPEN",
      billingStatus: null,
      completedAt: null,
      patient: { id: asha.patientId, name: "Tara Menon", gender: "FEMALE", dateOfBirth: "1990-04-12", archived: false },
      doctorId: doctors.A,
      doctorName: expect.any(String),
      appointment: { id: asha.appointmentId, status: "IN_PROGRESS", token: asha.token },
    });
    expect(visit.alerts.map((alert) => alert.label)).toEqual(["Penicillin", "Diabetes"]);
  });

  it("is read only with visits.view, a doctor only their own patients'", async () => {
    const asha = await waiting("Uma Shetty");
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: asha.appointmentId });
    await expect(getVisit(desk.tenant!, visitId)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    await expect(getVisit(doctorB.tenant!, visitId)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    expect((await getVisit(doctorA.tenant!, visitId)).id).toBe(visitId);
  });
});

describe("the queue and the detail with visits (D195, D198)", () => {
  it("name each appointment's visit for those who read visits, and who stepped out", async () => {
    const asha = await waiting("Vani Rao");
    const away = await waiting("Wasim Ali");
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: asha.appointmentId });
    await markSteppedOut(desk.tenant!, { appointmentId: away.appointmentId, out: true });

    const seen = await listQueue(nurse.tenant!, { doctorId: doctors.A });
    expect(seen.find((row) => row.id === asha.appointmentId)).toMatchObject({ visitId, steppedOutAt: null });
    expect(seen.find((row) => row.id === away.appointmentId)).toMatchObject({
      visitId: null,
      steppedOutAt: expect.any(String),
    });
    const unseen = await listQueue(desk.tenant!, { doctorId: doctors.A });
    expect(unseen.find((row) => row.id === asha.appointmentId)?.visitId).toBeNull();

    expect((await getAppointment(nurse.tenant!, asha.appointmentId)).visitId).toBe(visitId);
    expect((await getAppointment(desk.tenant!, away.appointmentId)).steppedOutAt).toEqual(expect.any(String));
  });
});
