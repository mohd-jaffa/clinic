import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { backToWaiting, markDone, sendIn } from "@/features/appointments/moves";
import { archivePatient } from "@/features/patients/api";
import { todayKey } from "@/lib/dates/calendar";
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
 * Treatments in the database (plan §14.1; R7.1, D248 – D255): started in a
 * visit as its doctor's, or from the profile for a doctor picked (D252);
 * statuses moving only as TREATMENT_STATUS_TRANSITIONS allows, from the copy
 * read (D251), a cancellation with or without a reason (D250); sessions from
 * any of the patient's visits (D249), the first starting a planned or
 * on-hold treatment (D248), removed only while their visit is open (D254); a
 * patient with one open not archived (D255). Read with visits.view in the
 * doctor scope, its cost included (D253); written only through its functions
 * with visits.edit.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "patients.edit",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
];
const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];

let clinic: TestClinic;
let desk: Member;
let nurse: Member;
let viewer: Member;
let maya: Member;
let ravi: Member;
const doctors = { maya: "", ravi: "" };
let consultation: string;
const today = todayKey();

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

/** A visit for the patient with a doctor: walked in and sent in. */
async function aVisit(patientId: string, doctorId: string) {
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultation }),
    randomUUID(),
  );
  const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
  return { visitId, appointmentId: arrival.id };
}

/** A new treatment through create_treatment, as `who`. */
const start = (who: Member, treatment: Record<string, unknown>, visitId: string | null = null) =>
  who.tenant!.supabase.rpc("create_treatment", { p_treatment: treatment, p_visit_id: visitId });

async function started(who: Member, treatment: Record<string, unknown>, visitId: string | null = null) {
  const { data, error } = await start(who, treatment, visitId);
  if (error) throw error;
  return data as { treatment_id: string; session_id: string | null };
}

const rowOf = async (id: string) => (await admin().from("treatments").select("*").eq("id", id).single()).data!;

const changeStatus = (who: Member, id: string, status: string, seen: string, reason: string | null = null) =>
  who.tenant!.supabase.rpc("change_treatment_status", {
    p_treatment_id: id,
    p_status: status,
    p_seen: seen,
    p_reason: reason,
  });

const record = (who: Member, treatmentId: string, visitId: string, note: string | null, seen: unknown) =>
  who.tenant!.supabase.rpc("record_treatment_session", {
    p_treatment_id: treatmentId,
    p_visit_id: visitId,
    p_note: note,
    p_seen: seen,
  });

const sees = async (who: Member, patientId: string) =>
  (await who.tenant!.supabase.rpc("can_see_patient", { p_patient_id: patientId })).data as boolean;

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, nurse, viewer, maya, ravi] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: [...CLINICAL, "patients.edit"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "visits.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
  ]);
  [doctors.maya, doctors.ravi] = await Promise.all([doctorIdOf(maya.memberId), doctorIdOf(ravi.memberId)]);
  const { data: type } = await admin()
    .from("appointment_types")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("name", "Consultation")
    .single();
  consultation = type!.id as string;
});

afterAll(removeAll);

describe("starting a treatment (plan §14.1, D252)", () => {
  it("in a visit, is that visit's doctor's; begun at once, the visit is its first session", async () => {
    const patientId = await addPatient("Rohan Mehta");
    const { visitId } = await aVisit(patientId, doctors.maya);

    const begun = await started(
      maya,
      { name: "Root canal", status: "IN_PROGRESS", doctor_id: doctors.ravi, note: "Access opened" },
      visitId,
    );
    expect(await rowOf(begun.treatment_id)).toMatchObject({
      patient_id: patientId,
      doctor_id: doctors.maya,
      status: "IN_PROGRESS",
      started_on: today,
      started_visit_id: visitId,
      created_by: maya.userId,
    });
    const { data: session } = await admin().from("treatment_sessions").select("*").eq("id", begun.session_id!).single();
    expect(session).toMatchObject({ treatment_id: begun.treatment_id, visit_id: visitId, note: "Access opened" });

    const planned = await started(
      maya,
      { name: "Crown", status: "PLANNED", estimated_cost_paise: 800000, next_due_on: today },
      visitId,
    );
    expect(planned.session_id).toBeNull();
    expect(await rowOf(planned.treatment_id)).toMatchObject({
      status: "PLANNED",
      started_on: null,
      estimated_cost_paise: 800000,
      next_due_on: today,
      started_visit_id: visitId,
    });
  });

  it("from the profile, is the doctor picked's, who sees the patient from then on", async () => {
    const patientId = await addPatient("Kiran Shah");
    expect(await sees(ravi, patientId)).toBe(false);
    const made = await started(nurse, {
      patient_id: patientId,
      doctor_id: doctors.ravi,
      name: "Braces",
      status: "IN_PROGRESS",
      description: "Upper and lower",
    });
    expect(made.session_id).toBeNull();
    expect(await rowOf(made.treatment_id)).toMatchObject({
      doctor_id: doctors.ravi,
      status: "IN_PROGRESS",
      started_on: today,
      started_visit_id: null,
    });
    expect(await sees(ravi, patientId)).toBe(true);
    // Maya has never seen Kiran: no treatment of hers for him.
    const { error } = await start(maya, {
      patient_id: patientId,
      doctor_id: doctors.maya,
      name: "X",
      status: "PLANNED",
    });
    expect(error?.hint).toBe("RECORD_NOT_FOUND");
  });

  it("refuses one starting on hold, due before today, with a doctor gone, or for an archived patient", async () => {
    const patientId = await addPatient("Meera Iyer");
    const base = { patient_id: patientId, doctor_id: doctors.ravi, name: "Scaling" };
    expect((await start(nurse, { ...base, status: "ON_HOLD" })).error?.hint).toBe("TREATMENT_STATUS_NOT_ALLOWED");
    expect((await start(nurse, { ...base })).error?.hint).toBe("TREATMENT_STATUS_NOT_ALLOWED");
    expect((await start(nurse, { ...base, status: "PLANNED", next_due_on: "2020-01-01" })).error?.hint).toBe(
      "VALIDATION_ERROR",
    );
    expect((await start(nurse, { ...base, status: "PLANNED", doctor_id: randomUUID() })).error?.hint).toBe(
      "DOCTOR_INACTIVE",
    );
    await archivePatient(desk.tenant!, patientId);
    expect((await start(nurse, { ...base, status: "PLANNED" })).error?.hint).toBe("PATIENT_ARCHIVED");
  });
});

describe("a treatment's status (plan §14.1; D250, D251)", () => {
  it("moves only as the table allows, from the status read; a double tap changes nothing more", async () => {
    const patientId = await addPatient("Anil Kumar");
    const { treatment_id: id } = await started(nurse, {
      patient_id: patientId,
      doctor_id: doctors.maya,
      name: "Implant",
      status: "PLANNED",
      next_due_on: today,
    });
    expect((await changeStatus(nurse, id, "COMPLETED", "PLANNED")).error?.hint).toBe("TREATMENT_STATUS_NOT_ALLOWED");
    expect((await changeStatus(nurse, id, "IN_PROGRESS", "ON_HOLD")).error?.hint).toBe("TREATMENT_CHANGED");

    expect((await changeStatus(nurse, id, "IN_PROGRESS", "PLANNED")).data).toEqual({
      before: "PLANNED",
      after: "IN_PROGRESS",
    });
    expect((await changeStatus(nurse, id, "IN_PROGRESS", "PLANNED")).data).toEqual({
      before: "IN_PROGRESS",
      after: "IN_PROGRESS",
    });
    expect(await rowOf(id)).toMatchObject({ status: "IN_PROGRESS", started_on: today, next_due_on: today });

    // Completed: stamped today, and due no more (plan §14.2); nowhere to go from there.
    expect((await changeStatus(maya, id, "COMPLETED", "IN_PROGRESS")).error).toBeNull();
    expect(await rowOf(id)).toMatchObject({ status: "COMPLETED", completed_on: today, next_due_on: null });
    for (const status of ["IN_PROGRESS", "ON_HOLD", "CANCELLED"]) {
      expect((await changeStatus(maya, id, status, "COMPLETED")).error?.hint, status).toBe(
        "TREATMENT_STATUS_NOT_ALLOWED",
      );
    }
  });

  it("cancels with a reason or without, stamped with when and by whom; a reason with nothing else", async () => {
    const patientId = await addPatient("Sunita Rao");
    const make = async () =>
      (await started(nurse, { patient_id: patientId, doctor_id: doctors.maya, name: "Bridge", status: "PLANNED" }))
        .treatment_id;
    const [reasoned, unreasoned] = [await make(), await make()];
    expect((await changeStatus(nurse, reasoned, "ON_HOLD", "PLANNED", "Away")).error?.hint).toBe("VALIDATION_ERROR");

    expect((await changeStatus(nurse, reasoned, "CANCELLED", "PLANNED", "Patient declined")).error).toBeNull();
    const cancelled = await rowOf(reasoned);
    expect(cancelled).toMatchObject({
      status: "CANCELLED",
      cancel_reason: "Patient declined",
      cancelled_by: nurse.userId,
    });
    expect(cancelled.cancelled_at).not.toBeNull();

    expect((await changeStatus(maya, unreasoned, "CANCELLED", "PLANNED")).error).toBeNull();
    expect(await rowOf(unreasoned)).toMatchObject({
      status: "CANCELLED",
      cancel_reason: null,
      cancelled_by: maya.userId,
    });
  });
});

describe("a treatment's details (D251, D252)", () => {
  it("change only from the copy read; while open it may go to another doctor, who then sees the patient", async () => {
    const patientId = await addPatient("Farah Khan");
    const { treatment_id: id } = await started(nurse, {
      patient_id: patientId,
      doctor_id: doctors.maya,
      name: "Root canal",
      status: "IN_PROGRESS",
    });
    const update = (who: Member, changes: Record<string, unknown>, seen: Record<string, unknown>) =>
      who.tenant!.supabase.rpc("update_treatment", { p_treatment_id: id, p_changes: changes, p_seen: seen });

    const { data, error } = await update(
      maya,
      { name: "Root canal (upper left)", estimated_cost_paise: 450000, next_due_on: today },
      { name: "Root canal", estimated_cost_paise: null, next_due_on: null },
    );
    expect(error).toBeNull();
    expect(data).toEqual({
      before: { name: "Root canal", estimated_cost_paise: null, next_due_on: null },
      after: { name: "Root canal (upper left)", estimated_cost_paise: 450000, next_due_on: today },
    });
    // The same copy again: someone changed it meanwhile.
    expect((await update(nurse, { name: "Planted" }, { name: "Root canal" })).error?.hint).toBe("TREATMENT_CHANGED");
    expect((await update(nurse, { status: "COMPLETED" }, { status: "IN_PROGRESS" })).error?.hint).toBe(
      "VALIDATION_ERROR",
    );
    expect((await update(nurse, { next_due_on: "2020-01-01" }, { next_due_on: today })).error?.hint).toBe(
      "VALIDATION_ERROR",
    );

    expect(await sees(ravi, patientId)).toBe(false);
    expect((await update(nurse, { doctor_id: doctors.ravi }, { doctor_id: doctors.maya })).error).toBeNull();
    expect(await sees(ravi, patientId)).toBe(true);
    // Maya keeps the patient she has treated (plan §27.3).
    expect(await sees(maya, patientId)).toBe(true);

    // Closed, it keeps its doctor and has no next due day; its name is still corrected.
    expect((await changeStatus(ravi, id, "COMPLETED", "IN_PROGRESS")).error).toBeNull();
    expect((await update(ravi, { doctor_id: doctors.maya }, { doctor_id: doctors.ravi })).error?.hint).toBe(
      "TREATMENT_CLOSED",
    );
    expect((await update(ravi, { next_due_on: today }, { next_due_on: null })).error?.hint).toBe("TREATMENT_CLOSED");
    expect(
      (await update(ravi, { name: "Root canal, upper left" }, { name: "Root canal (upper left)" })).error,
    ).toBeNull();
  });
});

describe("a session (plan §14.1; D248, D249, D254)", () => {
  it("is recorded from any of the patient's visits; the first on a planned one starts it on the visit's day", async () => {
    const patientId = await addPatient("Vikram Joshi");
    const { treatment_id: id } = await started(nurse, {
      patient_id: patientId,
      doctor_id: doctors.maya,
      name: "Root canal",
      status: "PLANNED",
    });
    // Seen by Dr. Ravi today: his visit works on Dr. Maya's treatment.
    const { visitId } = await aVisit(patientId, doctors.ravi);
    const { data, error } = await record(ravi, id, visitId, "Canal cleaned", null);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      created: true,
      before: null,
      after: { note: "Canal cleaned" },
      status_before: "PLANNED",
      status_after: "IN_PROGRESS",
    });
    expect(await rowOf(id)).toMatchObject({ status: "IN_PROGRESS", started_on: today, doctor_id: doctors.maya });

    // Its note changes from the copy read, and from no other.
    const changed = await record(nurse, id, visitId, "Canal cleaned and dressed", { note: "Canal cleaned" });
    expect(changed.data).toMatchObject({
      created: false,
      before: { note: "Canal cleaned" },
      after: { note: "Canal cleaned and dressed" },
      status_before: "IN_PROGRESS",
      status_after: "IN_PROGRESS",
    });
    expect((await record(maya, id, visitId, "Planted", null)).error?.hint).toBe("VISIT_CHANGED");
    expect((await record(maya, id, visitId, "Planted", { note: "Canal cleaned" })).error?.hint).toBe("VISIT_CHANGED");
    const { data: kept } = await admin().from("treatment_sessions").select("note").eq("treatment_id", id);
    expect(kept).toEqual([{ note: "Canal cleaned and dressed" }]);
  });

  it("resumes one on hold; is refused on a closed one, and on another patient's visit", async () => {
    const patientId = await addPatient("Leela Nair");
    const make = async (name: string) =>
      (await started(nurse, { patient_id: patientId, doctor_id: doctors.maya, name, status: "IN_PROGRESS" }))
        .treatment_id;
    const [held, done] = [await make("Braces"), await make("Filling")];
    await changeStatus(nurse, held, "ON_HOLD", "IN_PROGRESS");
    await changeStatus(nurse, done, "COMPLETED", "IN_PROGRESS");
    const { visitId } = await aVisit(patientId, doctors.maya);

    expect((await record(maya, held, visitId, null, null)).data).toMatchObject({
      status_before: "ON_HOLD",
      status_after: "IN_PROGRESS",
    });
    expect(await rowOf(held)).toMatchObject({ status: "IN_PROGRESS", started_on: today });
    expect((await record(maya, done, visitId, null, null)).error?.hint).toBe("TREATMENT_CLOSED");

    const other = await aVisit(await addPatient("Someone Else"), doctors.maya);
    expect((await record(maya, held, other.visitId, null, null)).error?.hint).toBe("RECORD_NOT_FOUND");
  });

  it("is removed by mistake only while its visit is open; the treatment it started stays started", async () => {
    const patientId = await addPatient("Arjun Das");
    const { treatment_id: id } = await started(nurse, {
      patient_id: patientId,
      doctor_id: doctors.maya,
      name: "Extraction",
      status: "PLANNED",
    });
    const { visitId, appointmentId } = await aVisit(patientId, doctors.maya);
    const first = await record(maya, id, visitId, null, null);
    // By its treatment and its visit, as the visit's screen names it (0025).
    const remove = (who: Member) =>
      who.tenant!.supabase.rpc("remove_treatment_session", { p_treatment_id: id, p_visit_id: visitId });

    expect((await remove(viewer)).error?.hint).toBe("AUTH_PERMISSION_DENIED");
    expect((await remove(maya)).data).toEqual({ session_id: (first.data as { session_id: string }).session_id });
    expect(await rowOf(id)).toMatchObject({ status: "IN_PROGRESS" });
    expect((await remove(maya)).error?.hint).toBe("RECORD_NOT_FOUND");

    await record(maya, id, visitId, "Tooth out", null);
    await markDone(desk.tenant!, { appointmentId });
    expect((await remove(maya)).error?.hint).toBe("TREATMENT_SESSION_KEPT");
    // Once done, its note is still corrected (visits.edit, D208).
    expect((await record(nurse, id, visitId, "Tooth out, stitches", { note: "Tooth out" })).error).toBeNull();
  });
});

describe("what a visit holds (D197, D226)", () => {
  it("keeps a visit with a session, or a treatment started in it, from Back to waiting", async () => {
    const patientId = await addPatient("Nisha Verma");
    const { treatment_id: id } = await started(nurse, {
      patient_id: patientId,
      doctor_id: doctors.maya,
      name: "Scaling",
      status: "PLANNED",
    });
    const worked = await aVisit(patientId, doctors.maya);
    await record(maya, id, worked.visitId, null, null);
    await backToWaiting(desk.tenant!, { appointmentId: worked.appointmentId });

    const other = await addPatient("Kabir Sethi");
    const planned = await aVisit(other, doctors.ravi);
    await started(ravi, { name: "Whitening", status: "PLANNED" }, planned.visitId);
    await backToWaiting(desk.tenant!, { appointmentId: planned.appointmentId });

    const { data: visits } = await maya
      .tenant!.supabase.from("visits")
      .select("id, recorded:visit_recorded")
      .in("id", [worked.visitId]);
    expect(visits).toEqual([{ id: worked.visitId, recorded: true }]);
    const { data: kept } = await admin().from("visits").select("id").in("id", [worked.visitId, planned.visitId]);
    expect(kept).toHaveLength(2);
  });
});

describe("archiving a patient with an open treatment (D255)", () => {
  it("is refused until it is completed or cancelled, named only to whoever reads treatments", async () => {
    const patientId = await addPatient("Pooja Menon");
    const { treatment_id: id } = await started(nurse, {
      patient_id: patientId,
      doctor_id: doctors.maya,
      name: "Root canal",
      status: "PLANNED",
    });
    await changeStatus(nurse, id, "ON_HOLD", "PLANNED");

    await expect(archivePatient(desk.tenant!, patientId)).rejects.toMatchObject({
      code: "PATIENT_HAS_TREATMENTS",
      kind: "BUSINESS_RULE",
      details: { name: null },
    });
    await expect(archivePatient(nurse.tenant!, patientId)).rejects.toMatchObject({
      code: "PATIENT_HAS_TREATMENTS",
      details: { name: "Root canal" },
    });

    await changeStatus(nurse, id, "CANCELLED", "ON_HOLD", "Moved away");
    await expect(archivePatient(desk.tenant!, patientId)).resolves.toMatchObject({ id: patientId });
    // Archived, its treatments are read-only (D103).
    expect((await changeStatus(nurse, id, "CANCELLED", "CANCELLED")).error?.hint).toBe("PATIENT_ARCHIVED");
  });
});

describe("reading and writing treatments (plan §27.4; D253)", () => {
  let patientId: string;
  let id: string;

  beforeAll(async () => {
    patientId = await addPatient("Ritu Bose");
    const { visitId } = await aVisit(patientId, doctors.maya);
    ({ treatment_id: id } = await started(
      maya,
      { name: "Crown", status: "IN_PROGRESS", estimated_cost_paise: 900000, note: "Prepared" },
      visitId,
    ));
  });

  it("reads them, cost and sessions too, with visits.view in the doctor scope, and none otherwise", async () => {
    for (const who of [viewer, maya, nurse]) {
      const { data } = await who
        .tenant!.supabase.from("treatments")
        .select("name, estimated_cost_paise, sessions:treatment_sessions(note)")
        .eq("id", id);
      expect(data).toEqual([{ name: "Crown", estimated_cost_paise: 900000, sessions: [{ note: "Prepared" }] }]);
    }
    // Without visits.view, none at all; a doctor who has never seen Ritu, none of hers.
    for (const [who, column, value] of [
      [desk, "clinic_id", clinic.clinicId],
      [ravi, "patient_id", patientId],
    ] as const) {
      const { data } = await who.tenant!.supabase.from("treatments").select("id").eq(column, value);
      expect(data).toEqual([]);
    }
    for (const [who, column, value] of [
      [desk, "clinic_id", clinic.clinicId],
      [ravi, "treatment_id", id],
    ] as const) {
      const { data } = await who.tenant!.supabase.from("treatment_sessions").select("id").eq(column, value);
      expect(data).toEqual([]);
    }
  });

  it("writes them only through their functions, and those only with visits.edit", async () => {
    const { supabase } = clinic.owner.tenant;
    const { error: inserted } = await supabase
      .from("treatments")
      .insert({ clinic_id: clinic.clinicId, patient_id: patientId, doctor_id: doctors.maya, name: "Planted" });
    expect(inserted?.code).toBe("42501");
    const { error: updated } = await supabase.from("treatments").update({ name: "Planted" }).eq("id", id);
    expect(updated?.code).toBe("42501");
    const { error: removed } = await supabase.from("treatment_sessions").delete().eq("treatment_id", id);
    expect(removed?.code).toBe("42501");

    const { visitId } = await aVisit(patientId, doctors.maya);
    for (const [name, args] of [
      ["create_treatment", { p_treatment: { name: "X", status: "PLANNED" }, p_visit_id: visitId }],
      ["update_treatment", { p_treatment_id: id, p_changes: { name: "X" }, p_seen: { name: "Crown" } }],
      ["change_treatment_status", { p_treatment_id: id, p_status: "ON_HOLD", p_seen: "IN_PROGRESS" }],
      ["record_treatment_session", { p_treatment_id: id, p_visit_id: visitId, p_note: null, p_seen: null }],
    ] as const) {
      const { error } = await viewer.tenant!.supabase.rpc(name, args);
      expect(error?.hint, name).toBe("AUTH_PERMISSION_DENIED");
    }
    expect((await rowOf(id)).name).toBe("Crown");
  });
});
