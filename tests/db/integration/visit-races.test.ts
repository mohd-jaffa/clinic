import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, nextPatient, sendIn } from "@/features/appointments/moves";
import { savePrescription } from "@/features/prescriptions/records";
import { saveVitals, startVisit, updateVisit } from "@/features/visits/records";
import {
  savePrescriptionSchema,
  saveVitalsSchema,
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
 * A visit's moves and saves at the same moment (plan §34.1; R6.6, D232):
 * the desk and the doctor pressing Next patient together; Send in, Done and
 * New visit pressed twice at once; the doctor and the assistant saving the
 * same section, or the prescription, from the same copy at once (D206); and
 * the prescription saved as the desk marks the patient done. Each request is
 * its own transaction through PostgREST, so only the database keeps them
 * apart — the doctor's queue lock (0018), the visit's and the appointment's
 * row locks, the copy each save was made from — never a read before the
 * write.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
];
const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];

let clinic: TestClinic;
let desks: Member[];
let assistant: Member;
let doctor: Member;
let doctorId: string;
let consultation: string;

/** Each settled as it comes back, all sent at once. */
const atOnce = <T>(...requests: (() => Promise<T>)[]) => Promise.allSettled(requests.map((request) => request()));
const fulfilled = <T>(results: PromiseSettledResult<T>[]) =>
  results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
const refused = <T>(results: PromiseSettledResult<T>[]) =>
  results.flatMap((result) => (result.status === "rejected" ? [result.reason as unknown] : []));

async function addPatient(name: string) {
  const { data, error } = await desks[0]
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  return data.patient_id;
}

/** A patient walked in now to the doctor, waiting with the next token. */
async function waiting(name: string) {
  const patientId = await addPatient(name);
  const arrival = await addWalkIn(
    desks[0].tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultation }),
    randomUUID(),
  );
  return { appointmentId: arrival.id, patientId };
}

/** A patient sent in to the doctor, and their open visit. */
async function inRoom(name: string) {
  const patient = await waiting(name);
  const { visitId } = await sendIn(desks[0].tenant!, { appointmentId: patient.appointmentId, others: "KEEP" });
  return { ...patient, visitId };
}

/** Who is with the doctor now, and who still waits, by token. */
async function queueNow() {
  const { data } = await admin()
    .from("appointments")
    .select("id, status, token_number")
    .eq("doctor_id", doctorId)
    .in("status", ["ARRIVED", "IN_PROGRESS"])
    .order("token_number");
  return {
    inRoom: data!.filter((row) => row.status === "IN_PROGRESS").map((row) => row.id as string),
    waiting: data!.filter((row) => row.status === "ARRIVED").map((row) => row.id as string),
  };
}

const auditsOf = async (entityId: string) =>
  (await admin().from("audit_logs").select("action, changes").eq("entity_id", entityId).order("created_at")).data!;

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
const vitals = (typed: Partial<VitalsInput>) => saveVitalsSchema.parse({ vitals: { ...NONE, ...typed }, seen: null });
const notes = (diagnosis: string) =>
  visitChangeSchema.parse({
    section: "NOTES",
    changes: { complaint: "", diagnosis, notes: "" },
    seen: { complaint: null, diagnosis: null, notes: null },
  });
const prescription = (medicine: string) =>
  savePrescriptionSchema.parse({
    prescription: {
      items: [{ medicine, strength: "", dose: "", frequency: "", timing: "", durationDays: "", instructions: "" }],
      advice: "",
      printDiagnosis: false,
    },
    seen: null,
  });

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  const members = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: [...CLINICAL, "appointments.view", "prescriptions.write"] }),
    addMember(clinic.clinicId, {
      role: "DOCTOR",
      permissions: [...CLINICAL, "appointments.view", "appointments.edit"],
    }),
  ]);
  desks = members.slice(0, 2);
  [assistant, doctor] = members.slice(2);
  doctorId = (await admin().from("doctors").select("id").eq("member_id", doctor.memberId).single()).data!.id as string;
  await admin().from("doctors").update({ registration_number: "KMC 12345" }).eq("id", doctorId);
  consultation = (
    await admin()
      .from("appointment_types")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .single()
  ).data!.id as string;
});

// Each test starts with the doctor's room free and no one waiting: whoever is left is seen and done.
beforeEach(async () => {
  const { inRoom: still, waiting: left } = await queueNow();
  for (const appointmentId of left) await sendIn(desks[0].tenant!, { appointmentId, others: "KEEP" });
  for (const appointmentId of [...still, ...left]) await markDone(desks[0].tenant!, { appointmentId });
});

afterAll(removeAll);

describe("Next patient pressed by the desk and the doctor at once (plan §11.4; D193, D196)", () => {
  it("with the room free, sends one patient in — the lowest token — and tells the other press who is in", async () => {
    const lowest = await waiting("Jaya Das");
    const next = await waiting("Kunal Rao");
    const results = await atOnce(
      () => nextPatient(desks[0].tenant!, { doctorId }),
      () => nextPatient(doctor.tenant!, { doctorId }),
    );
    // Both answer, each naming the one patient in: no one skipped, no two in.
    const sent = fulfilled(results).map((answer) => answer.sent?.appointmentId);
    expect(sent).toEqual([lowest.appointmentId, lowest.appointmentId]);
    expect(await queueNow()).toEqual({ inRoom: [lowest.appointmentId], waiting: [next.appointmentId] });
  });

  it("after the patient in, finishes them once and sends in only the next — the one after still waiting", async () => {
    const current = await inRoom("Lina George");
    const next = await waiting("Manoj Pillai");
    const after = await waiting("Nisha Varma");
    const results = await atOnce(
      () => nextPatient(desks[0].tenant!, { doctorId, appointmentId: current.appointmentId }),
      () => nextPatient(doctor.tenant!, { doctorId, appointmentId: current.appointmentId }),
    );
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const sent = fulfilled(results).flatMap((answer) => (answer.sent ? [answer.sent.appointmentId] : []));
    expect(new Set(sent)).toEqual(new Set([next.appointmentId]));
    expect(await queueNow()).toEqual({ inRoom: [next.appointmentId], waiting: [after.appointmentId] });
    const closed = await auditsOf(current.visitId);
    expect(closed.filter((audit) => audit.action === "STATUS_CHANGE")).toHaveLength(1);
  });
});

describe("pressed twice at once (plan §11.4, §12.1; D204)", () => {
  it("sends one waiting patient in once: one visit, one move audited", async () => {
    const patient = await waiting("Om Prakash");
    const results = await atOnce(
      () => sendIn(desks[0].tenant!, { appointmentId: patient.appointmentId, others: "KEEP" }),
      () => sendIn(desks[1].tenant!, { appointmentId: patient.appointmentId, others: "KEEP" }),
    );
    const [first, second] = fulfilled(results);
    expect(second.visitId).toBe(first.visitId);
    const { data: visits } = await admin().from("visits").select("id").eq("appointment_id", patient.appointmentId);
    expect(visits).toEqual([{ id: first.visitId }]);
    const moves = (await auditsOf(patient.appointmentId)).filter(
      (audit) => (audit.changes as { status?: { to: string } }).status?.to === "IN_PROGRESS",
    );
    expect(moves).toHaveLength(1);
    expect(await auditsOf(first.visitId)).toHaveLength(1);
  });

  it("marks the patient in done once: the visit closed once, as To bill, one close audited", async () => {
    const patient = await inRoom("Priya Shah");
    const results = await atOnce(
      () => markDone(desks[0].tenant!, { appointmentId: patient.appointmentId }),
      () => markDone(doctor.tenant!, { appointmentId: patient.appointmentId }),
    );
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const { data: visit } = await admin()
      .from("visits")
      .select("status, billing_status")
      .eq("id", patient.visitId)
      .single();
    expect(visit).toEqual({ status: "COMPLETED", billing_status: "TO_BILL" });
    const closes = (await auditsOf(patient.visitId)).filter((audit) => audit.action === "STATUS_CHANGE");
    expect(closes).toHaveLength(1);
  });

  it("starts one visit from a profile when New visit is pressed twice at once, both opening it", async () => {
    const patientId = await addPatient("Rhea Kapoor");
    // Hers, so the doctor may start it too (D3).
    await admin().from("patients").update({ assigned_doctor_id: doctorId }).eq("id", patientId);
    const results = await atOnce(
      () => startVisit(doctor.tenant!, { patientId, doctorId }),
      () => startVisit(assistant.tenant!, { patientId, doctorId }),
    );
    const [first, second] = fulfilled(results);
    expect(second.visitId).toBe(first.visitId);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    const { data: visits } = await admin().from("visits").select("id").eq("patient_id", patientId);
    expect(visits).toHaveLength(1);
  });
});

describe("two saves from the same copy at once (D202, D206)", () => {
  /** One saved and the other told the visit changed — never both, never neither. */
  const oneSaved = <T>(results: PromiseSettledResult<T>[]) => {
    expect(fulfilled(results)).toHaveLength(1);
    expect(refused(results)).toEqual([expect.objectContaining({ code: "VISIT_CHANGED" })]);
    return results.findIndex((result) => result.status === "fulfilled");
  };

  it("keeps one of the vitals the doctor and the assistant save at once, and refuses the other", async () => {
    const { visitId } = await inRoom("Sana Iqbal");
    const typed = [vitals({ pulse: "72" }), vitals({ pulse: "88" })];
    const saved = oneSaved(
      await atOnce(
        () => saveVitals(doctor.tenant!, { visitId }, typed[0]),
        () => saveVitals(assistant.tenant!, { visitId }, typed[1]),
      ),
    );
    const { data } = await admin().from("vitals").select("pulse").eq("visit_id", visitId);
    expect(data).toEqual([{ pulse: saved === 0 ? 72 : 88 }]);
  });

  it("opens one visit when a waiting patient's vitals are saved twice at once, and refuses the other", async () => {
    const { appointmentId } = await waiting("Tara Menon");
    oneSaved(
      await atOnce(
        () => saveVitals(assistant.tenant!, { appointmentId }, vitals({ weightKg: "60" })),
        () => saveVitals(doctor.tenant!, { appointmentId }, vitals({ weightKg: "61" })),
      ),
    );
    const { data: visits } = await admin().from("visits").select("id").eq("appointment_id", appointmentId);
    expect(visits).toHaveLength(1);
  });

  it("keeps one of the notes saved at once from the same copy", async () => {
    const { visitId } = await inRoom("Uma Nair");
    const saved = oneSaved(
      await atOnce(
        () => updateVisit(doctor.tenant!, visitId, notes("Dental caries")),
        () => updateVisit(assistant.tenant!, visitId, notes("Gingivitis")),
      ),
    );
    const { data } = await admin().from("visits").select("diagnosis").eq("id", visitId).single();
    expect(data!.diagnosis).toBe(saved === 0 ? "Dental caries" : "Gingivitis");
  });

  it("keeps one of the prescriptions saved at once from the same copy, its medicines whole", async () => {
    const { visitId } = await inRoom("Varun Rao");
    const saved = oneSaved(
      await atOnce(
        () => savePrescription(doctor.tenant!, visitId, prescription("Paracetamol")),
        () => savePrescription(assistant.tenant!, visitId, prescription("Ibuprofen")),
      ),
    );
    const { data } = await admin()
      .from("prescriptions")
      .select("items:prescription_items(medicine)")
      .eq("visit_id", visitId)
      .single();
    expect(data!.items).toEqual([{ medicine: saved === 0 ? "Paracetamol" : "Ibuprofen" }]);
  });
});

describe("the prescription saved as the patient is marked done (D215)", () => {
  it("keeps both: the visit done, the prescription saved", async () => {
    const patient = await inRoom("Wasim Khan");
    const results = await atOnce<unknown>(
      () => savePrescription(doctor.tenant!, patient.visitId, prescription("Amoxicillin")),
      () => markDone(desks[0].tenant!, { appointmentId: patient.appointmentId }),
    );
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const [{ data: visit }, { data: kept }] = await Promise.all([
      admin().from("visits").select("status").eq("id", patient.visitId).single(),
      admin().from("prescriptions").select("items:prescription_items(medicine)").eq("visit_id", patient.visitId),
    ]);
    expect(visit).toEqual({ status: "COMPLETED" });
    expect(kept).toEqual([{ items: [{ medicine: "Amoxicillin" }] }]);
  });
});
