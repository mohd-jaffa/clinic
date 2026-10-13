import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn, changeAppointmentStatus, listQueue } from "@/features/appointments/api";
import { backToWaiting, markDone, sendIn } from "@/features/appointments/moves";
import { getVisit } from "@/features/visits/api";
import { finishVisit, saveVitals, startVisit, updateVisit } from "@/features/visits/records";
import type { Vitals } from "@/features/visits/types";
import { addDaysKey } from "@/lib/dates/calendar";
import {
  saveVitalsSchema,
  startVisitSchema,
  visitChangeSchema,
  walkInSchema,
  type VitalsInput,
} from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * What a visit records (plan §12.1, §12.2; R6.2, D202 – D208): the vitals,
 * complaint, diagnosis, notes and follow-up, each section saved alone and
 * refused when saved from an older copy (D206); a waiting patient's vitals
 * opening their visit, which Send in continues (D203); New visit and its
 * Done (D204); corrections after Done with visits.edit alone (D208). Each
 * audited, clinical text by name only; each within the doctor scope.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
];
const NURSE: Permission[] = ["patients.view", "appointments.view", "visits.view", "visits.create", "visits.edit"];

let clinic: TestClinic;
let desk: Member;
let nurse: Member;
let taker: Member;
let reader: Member;
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

/** A patient walked in now to a doctor, waiting. */
async function waiting(name: string, doctorId = doctors.A) {
  const patientId = await addPatient(name);
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultation }),
    randomUUID(),
  );
  return { appointmentId: arrival.id, patientId };
}

/** A patient sent in, and their open visit. */
async function inRoom(name: string) {
  const patient = await waiting(name);
  const { visitId } = await sendIn(desk.tenant!, { appointmentId: patient.appointmentId, others: "KEEP" });
  return { ...patient, visitId };
}

const NONE: VitalsInput = {
  systolic: "",
  diastolic: "",
  pulse: "",
  temperatureF: "",
  spo2: "",
  respiratoryRate: "",
  weightKg: "",
  heightCm: "",
};
const vitals = (typed: Partial<VitalsInput>, seen: Vitals | null = null) =>
  saveVitalsSchema.parse({ vitals: { ...NONE, ...typed }, seen });
const notes = (changes: Record<string, string>, seen: Record<string, string | null>) =>
  visitChangeSchema.parse({
    section: "NOTES",
    changes: { complaint: "", diagnosis: "", notes: "", ...changes },
    seen: { complaint: null, diagnosis: null, notes: null, ...seen },
  });
const followUp = (followUpOn: string, seen: string | null = null) =>
  visitChangeSchema.parse({ section: "FOLLOW_UP", changes: { followUpOn }, seen: { followUpOn: seen } });

const auditsOf = async (entityId: string) =>
  (
    await admin()
      .from("audit_logs")
      .select("action, entity_type, changes")
      .eq("entity_id", entityId)
      .order("created_at")
  ).data!;
const visitRow = async (id: string) =>
  (await admin().from("visits").select("status, started_at, billing_status, appointment_id").eq("id", id).single())
    .data!;

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, nurse, taker, reader, doctorA, doctorB] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: NURSE }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "visits.view", "visits.create"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "visits.view"] }),
    addMember(clinic.clinicId, {
      role: "DOCTOR",
      permissions: ["patients.view", "appointments.view", "appointments.edit", ...NURSE.slice(2)],
    }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", ...NURSE.slice(2)] }),
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

/** Ends everyone still waiting or in, so each test starts with the rooms free. */
beforeEach(async () => {
  const { data } = await admin()
    .from("appointments")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("status", "IN_PROGRESS");
  for (const { id } of data ?? []) await markDone(desk.tenant!, { appointmentId: id });
});

afterAll(removeAll);

describe("saveVitals on a visit (D202, D206)", () => {
  it("takes the readings, and changes them only from the copy last read — audited by which changed", async () => {
    const { visitId } = await inRoom("Asha Iyer");
    const first = await saveVitals(
      nurse.tenant!,
      { visitId },
      vitals({ systolic: "120", diastolic: "80", pulse: "72" }),
    );
    expect(first).toEqual({
      visitId,
      vitals: {
        systolic: 120,
        diastolic: 80,
        pulse: 72,
        temperatureF: null,
        spo2: null,
        respiratoryRate: null,
        weightKg: null,
        heightCm: null,
      },
    });

    // Saved again from no copy — someone took them meanwhile.
    await expect(saveVitals(doctorA.tenant!, { visitId }, vitals({ pulse: "80" }))).rejects.toMatchObject({
      code: "VISIT_CHANGED",
    });

    const second = await saveVitals(
      doctorA.tenant!,
      { visitId },
      vitals(
        { systolic: "120", diastolic: "80", pulse: "76", temperatureF: "98.6", weightKg: "64.5", heightCm: "162" },
        first.vitals,
      ),
    );
    expect(second.vitals).toMatchObject({ pulse: 76, temperatureF: 98.6, weightKg: 64.5, heightCm: 162 });
    expect((await getVisit(reader.tenant!, visitId)).vitals).toEqual(second.vitals);

    const vitalsId = (await admin().from("vitals").select("id").eq("visit_id", visitId).single()).data!.id as string;
    expect((await auditsOf(vitalsId)).map(({ action, changes }) => [action, changes])).toEqual([
      ["CREATE", { fields: ["systolic", "diastolic", "pulse"] }],
      ["UPDATE", { fields: ["pulse", "temperature_f", "weight_kg", "height_cm"] }],
    ]);
  });

  it("holds each reading to its limits, blood pressure both or neither", async () => {
    const { visitId } = await inRoom("Bina Das");
    const { error } = await nurse.tenant!.supabase.rpc("save_vitals", {
      p_visit_id: visitId,
      p_appointment_id: null,
      p_vitals: { systolic: 300 },
      p_seen: null,
    });
    expect(error?.code).toBe("23514");
    const { error: half } = await nurse.tenant!.supabase.rpc("save_vitals", {
      p_visit_id: visitId,
      p_appointment_id: null,
      p_vitals: { systolic: 120 },
      p_seen: null,
    });
    expect(half?.code).toBe("23514");
  });

  it("needs visits.create while open, visits.edit once done (D208), and its patient not archived", async () => {
    const patient = await inRoom("Chitra Rao");
    await expect(
      saveVitals(reader.tenant!, { visitId: patient.visitId }, vitals({ pulse: "70" })),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    const taken = await saveVitals(taker.tenant!, { visitId: patient.visitId }, vitals({ pulse: "70" }));

    await markDone(desk.tenant!, { appointmentId: patient.appointmentId });
    await expect(
      saveVitals(taker.tenant!, { visitId: patient.visitId }, vitals({ pulse: "71" }, taken.vitals)),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    const corrected = await saveVitals(
      nurse.tenant!,
      { visitId: patient.visitId },
      vitals({ pulse: "71" }, taken.vitals),
    );
    expect(corrected.vitals?.pulse).toBe(71);

    await admin().from("patients").update({ archived_at: new Date().toISOString() }).eq("id", patient.patientId);
    await expect(
      saveVitals(nurse.tenant!, { visitId: patient.visitId }, vitals({ pulse: "72" }, corrected.vitals)),
    ).rejects.toMatchObject({ code: "PATIENT_ARCHIVED" });
  });

  it("is kept within the doctor scope", async () => {
    const { visitId } = await inRoom("Deepa Nair");
    await expect(saveVitals(doctorB.tenant!, { visitId }, vitals({ pulse: "70" }))).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
  });

  it("counts a visit whose readings were all cleared as holding nothing: Back to waiting removes it", async () => {
    const patient = await inRoom("Esha Menon");
    const taken = await saveVitals(nurse.tenant!, { visitId: patient.visitId }, vitals({ spo2: "98" }));
    await saveVitals(nurse.tenant!, { visitId: patient.visitId }, vitals({}, taken.vitals));
    await backToWaiting(desk.tenant!, { appointmentId: patient.appointmentId });
    expect((await admin().from("visits").select("id").eq("id", patient.visitId)).data).toEqual([]);
  });
});

describe("saveVitals for a patient still waiting (D203)", () => {
  it("opens their visit, not yet started, which Send in continues — and which keeps the booking from being cancelled", async () => {
    const patient = await waiting("Farah Khan");
    const { visitId } = await saveVitals(
      nurse.tenant!,
      { appointmentId: patient.appointmentId },
      vitals({ weightKg: "58" }),
    );
    expect(await visitRow(visitId)).toEqual({
      status: "OPEN",
      started_at: null,
      billing_status: null,
      appointment_id: patient.appointmentId,
    });
    const queue = await listQueue(nurse.tenant!, { doctorId: doctors.A });
    expect(queue.find((row) => row.id === patient.appointmentId)).toMatchObject({ status: "ARRIVED", visitId });
    await expect(
      changeAppointmentStatus(desk.tenant!, patient.appointmentId, { status: "NO_SHOW", reason: null }),
    ).rejects.toMatchObject({ code: "APPOINTMENT_HAS_VISIT" });

    // Taken again from the copy read, through the appointment: the same visit.
    const again = await saveVitals(
      nurse.tenant!,
      { appointmentId: patient.appointmentId },
      vitals({ weightKg: "58", heightCm: "160" }, (await getVisit(nurse.tenant!, visitId)).vitals),
    );
    expect(again.visitId).toBe(visitId);

    const sent = await sendIn(desk.tenant!, { appointmentId: patient.appointmentId });
    expect(sent.visitId).toBe(visitId);
    expect((await visitRow(visitId)).started_at).toEqual(expect.any(String));
    expect((await getVisit(nurse.tenant!, visitId)).vitals).toMatchObject({ weightKg: 58, heightCm: 160 });
    expect((await auditsOf(visitId)).map(({ action }) => action)).toEqual(["CREATE"]);
  });

  it("opens nothing for no reading, and only while they wait or are in", async () => {
    const patient = await waiting("Gita Bose");
    await expect(saveVitals(nurse.tenant!, { appointmentId: patient.appointmentId }, vitals({}))).rejects.toMatchObject(
      { code: "VALIDATION_ERROR" },
    );
    await changeAppointmentStatus(desk.tenant!, patient.appointmentId, { status: "NO_SHOW", reason: null });
    await expect(
      saveVitals(nurse.tenant!, { appointmentId: patient.appointmentId }, vitals({ pulse: "70" })),
    ).rejects.toMatchObject({ code: "APPOINTMENT_STATUS_NOT_ALLOWED" });
    await expect(
      saveVitals(reader.tenant!, { appointmentId: patient.appointmentId }, vitals({ pulse: "70" })),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("updateVisit (D202, D205, D206)", () => {
  it("saves complaint, diagnosis and notes from the copy read — audited by name alone", async () => {
    const { visitId } = await inRoom("Hema Iyer");
    expect(
      await updateVisit(nurse.tenant!, visitId, notes({ complaint: "  Fever, 3 days ", notes: "Rest\u200b" }, {})),
    ).toEqual({ complaint: "Fever, 3 days", diagnosis: null, notes: "Rest" });
    await expect(updateVisit(doctorA.tenant!, visitId, notes({ diagnosis: "Viral" }, {}))).rejects.toMatchObject({
      code: "VISIT_CHANGED",
    });
    await updateVisit(
      doctorA.tenant!,
      visitId,
      notes(
        { complaint: "Fever, 3 days", diagnosis: "Viral fever", notes: "Rest" },
        {
          complaint: "Fever, 3 days",
          notes: "Rest",
        },
      ),
    );
    const visit = await getVisit(reader.tenant!, visitId);
    expect(visit).toMatchObject({ complaint: "Fever, 3 days", diagnosis: "Viral fever", notes: "Rest" });
    expect((await auditsOf(visitId)).filter(({ action }) => action === "UPDATE").map(({ changes }) => changes)).toEqual(
      [{ fields: ["complaint", "notes"] }, { fields: ["diagnosis"] }],
    );
  });

  it("sets the follow-up after the visit's day, audited by its value; the notes are not touched", async () => {
    const { visitId } = await inRoom("Isha Roy");
    const { day } = await getVisit(nurse.tenant!, visitId);
    await expect(updateVisit(nurse.tenant!, visitId, followUp(day))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    const review = addDaysKey(day, 7);
    expect(await updateVisit(nurse.tenant!, visitId, followUp(review))).toEqual({ followUpOn: review });
    expect(await updateVisit(nurse.tenant!, visitId, followUp("", review))).toEqual({ followUpOn: null });
    expect((await auditsOf(visitId)).filter(({ action }) => action === "UPDATE").map(({ changes }) => changes)).toEqual(
      [{ follow_up_on: { from: null, to: review } }, { follow_up_on: { from: review, to: null } }],
    );
  });

  it("needs visits.edit, and is refused for another doctor's patient", async () => {
    const { visitId } = await inRoom("Jaya Pillai");
    await expect(updateVisit(taker.tenant!, visitId, notes({ notes: "Hm" }, {}))).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    await expect(updateVisit(doctorB.tenant!, visitId, notes({ notes: "Hm" }, {}))).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
  });
});

describe("startVisit and finishVisit (D204)", () => {
  it("starts a visit from the profile, finds it open on a second tap, and closes it as To bill", async () => {
    const patientId = await addPatient("Kavya Shetty");
    const started = await startVisit(nurse.tenant!, startVisitSchema.parse({ patientId, doctorId: doctors.A }));
    expect(started).toEqual({ visitId: expect.any(String), created: true });
    // The doctor, who sees the patient from then on, taps it again: the same visit.
    expect(await startVisit(doctorA.tenant!, startVisitSchema.parse({ patientId, doctorId: doctors.A }))).toEqual({
      visitId: started.visitId,
      created: false,
    });
    expect((await getVisit(doctorA.tenant!, started.visitId)).appointment).toBeNull();

    await finishVisit(doctorA.tenant!, started.visitId);
    expect(await visitRow(started.visitId)).toMatchObject({ status: "COMPLETED", billing_status: "TO_BILL" });
    await finishVisit(doctorA.tenant!, started.visitId);
    expect((await auditsOf(started.visitId)).map(({ action }) => action)).toEqual(["CREATE", "STATUS_CHANGE"]);
  });

  it("refuses an archived patient, a doctor not on the team, someone without visits.create, and a queue visit", async () => {
    const patientId = await addPatient("Lata Menon");
    await expect(
      startVisit(reader.tenant!, startVisitSchema.parse({ patientId, doctorId: doctors.A })),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    await expect(
      startVisit(nurse.tenant!, startVisitSchema.parse({ patientId, doctorId: randomUUID() })),
    ).rejects.toMatchObject({ code: "DOCTOR_INACTIVE" });
    await admin().from("patients").update({ archived_at: new Date().toISOString() }).eq("id", patientId);
    await expect(
      startVisit(nurse.tenant!, startVisitSchema.parse({ patientId, doctorId: doctors.A })),
    ).rejects.toMatchObject({ code: "PATIENT_ARCHIVED" });

    const { visitId } = await inRoom("Maya Das");
    await expect(finishVisit(nurse.tenant!, visitId)).rejects.toMatchObject({
      code: "APPOINTMENT_STATUS_NOT_ALLOWED",
    });
  });

  it("is kept within the doctor scope", async () => {
    const patientId = await addPatient("Nila Rao");
    await expect(
      startVisit(doctorB.tenant!, startVisitSchema.parse({ patientId, doctorId: doctors.B })),
    ).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });
});
