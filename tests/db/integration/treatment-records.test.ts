import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { getPatientSummary } from "@/features/patients/summary";
import {
  changeTreatmentStatus,
  createTreatment,
  recordSession,
  removeSession,
  updateTreatment,
} from "@/features/treatments/records";
import { getVisit, listPatientVisits } from "@/features/visits/api";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import {
  changeTreatmentSchema,
  newTreatmentSchema,
  treatmentSessionSchema,
  treatmentStatusSchema,
  walkInSchema,
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
 * Treatments on the visit and the profile (plan §14.1; R7.2, D256 – D263),
 * through the feature functions the routes call: started in a visit or from
 * the profile, read with the visit (`visit_treatments`) and the summary, a
 * session completing its treatment in one save (D257) or neither, removed by
 * its treatment and visit (D254), the history naming them (D262) — each
 * audited, clinical text by name alone.
 */
type Member = SignedIn & { memberId: string };

const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];

let clinic: TestClinic;
let desk: Member;
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
      p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  return data.patient_id;
}

async function aVisit(patientId: string, doctorId: string) {
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultation }),
    randomUUID(),
  );
  const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
  return { visitId, appointmentId: arrival.id };
}

const typed = (patientId: string, overrides: Record<string, unknown>) =>
  newTreatmentSchema.parse({
    patientId,
    visitId: null,
    doctorId: "",
    start: "PLANNED",
    name: "Crown",
    description: "",
    estimatedCost: "",
    note: "",
    nextDueOn: "",
    ...overrides,
  });

const auditsOf = async (entityId: string) =>
  (
    await admin()
      .from("audit_logs")
      .select("action, entity_type, changes")
      .eq("entity_id", entityId)
      .order("created_at")
  ).data!;

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, maya, ravi] = await Promise.all([
    addMember(clinic.clinicId, {
      permissions: [
        "patients.view",
        "patients.create",
        "appointments.view",
        "appointments.create",
        "appointments.edit",
      ],
    }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
  ]);
  [doctors.maya, doctors.ravi] = await Promise.all([doctorIdOf(maya.memberId), doctorIdOf(ravi.memberId)]);
  await admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId);
  const { data: type } = await admin()
    .from("appointment_types")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("name", "Consultation")
    .single();
  consultation = type!.id as string;
});

afterAll(removeAll);

describe("a treatment begun in a visit (D252, D256, D258)", () => {
  it("is the visit's doctor's, its first session the visit's, read with the visit and audited by name", async () => {
    const patientId = await addPatient("Anita Rao");
    const { visitId } = await aVisit(patientId, doctors.maya);
    const made = await createTreatment(
      maya.tenant!,
      typed(patientId, { visitId, start: "IN_PROGRESS", name: "Root canal", estimatedCost: "4,500", note: "Opened" }),
      "req_rc",
    );
    const visit = await getVisit(maya.tenant!, visitId);
    expect(visit.treatments).toEqual([
      expect.objectContaining({
        id: made.id,
        doctorId: doctors.maya,
        doctorName: "Maya Rao",
        status: "IN_PROGRESS",
        estimatedCostPaise: 450000,
        startedOn: today,
        startedVisitId: visitId,
        sessions: [expect.objectContaining({ visitId, day: today, doctorName: "Maya Rao", note: "Opened" })],
      }),
    ]);
    const [audit] = await auditsOf(made.id);
    expect(audit).toMatchObject({
      action: "CREATE",
      entity_type: "treatments",
      changes: { status: { to: "IN_PROGRESS" }, estimated_cost_paise: { to: 450000 }, fields: ["name"] },
    });
    expect(JSON.stringify(audit.changes)).not.toContain("Root canal");
  });
});

describe("a visit's treatments (D256)", () => {
  it("are the patient's open ones and those touched in it — not one closed elsewhere — oldest first", async () => {
    const patientId = await addPatient("Kiran Shah");
    const [first, closedElsewhere, open] = [
      await createTreatment(clinic.owner.tenant, typed(patientId, { doctorId: doctors.maya, name: "Scaling" })),
      await createTreatment(clinic.owner.tenant, typed(patientId, { doctorId: doctors.maya, name: "Filling" })),
      await createTreatment(clinic.owner.tenant, typed(patientId, { doctorId: doctors.maya, name: "Crown" })),
    ];
    await changeTreatmentStatus(
      maya.tenant!,
      closedElsewhere.id,
      treatmentStatusSchema.parse({ status: "CANCELLED", seen: "PLANNED" }),
    );
    const { visitId } = await aVisit(patientId, doctors.maya);
    // Worked on here, then completed: it stays on this visit's card.
    await recordSession(
      maya.tenant!,
      first.id,
      visitId,
      treatmentSessionSchema.parse({ note: "", complete: true, seen: null }),
    );
    const visit = await getVisit(maya.tenant!, visitId);
    expect(visit.treatments.map(({ name, status }) => [name, status])).toEqual([
      ["Scaling", "COMPLETED"],
      ["Crown", "PLANNED"],
    ]);
    expect(visit.treatments[1].id).toBe(open.id);
    // Dr. Ravi has never seen Kiran: his read of the summary holds none of hers (D3).
    expect(await getPatientSummary(ravi.tenant!, patientId)).toMatchObject({ treatments: [] });
    const { treatments } = await getPatientSummary(maya.tenant!, patientId);
    expect(treatments!.map(({ name }) => name)).toEqual(["Scaling", "Filling", "Crown"]);
  });
});

describe("a session that completes its treatment (D257)", () => {
  it("records it and completes it together, audited as each happened", async () => {
    const patientId = await addPatient("Leela Nair");
    const { id } = await createTreatment(
      clinic.owner.tenant,
      typed(patientId, { doctorId: doctors.maya, name: "Extraction" }),
    );
    const { visitId } = await aVisit(patientId, doctors.maya);
    expect(
      await recordSession(
        maya.tenant!,
        id,
        visitId,
        treatmentSessionSchema.parse({ note: "Tooth out", complete: true, seen: null }),
        "req_x",
      ),
    ).toEqual({ note: "Tooth out", status: "COMPLETED" });
    const { data: row } = await admin()
      .from("treatments")
      .select("status, started_on, completed_on")
      .eq("id", id)
      .single();
    expect(row).toEqual({ status: "COMPLETED", started_on: today, completed_on: today });
    expect((await auditsOf(id)).map(({ action, changes }) => [action, changes])).toEqual([
      ["CREATE", expect.anything()],
      ["STATUS_CHANGE", { status: { from: "PLANNED", to: "IN_PROGRESS" } }],
      ["STATUS_CHANGE", { status: { from: "IN_PROGRESS", to: "COMPLETED" } }],
    ]);
  });

  it("saves neither when it cannot complete — on hold since its session", async () => {
    const patientId = await addPatient("Meena Iyer");
    const { id } = await createTreatment(
      clinic.owner.tenant,
      typed(patientId, { doctorId: doctors.maya, name: "Braces" }),
    );
    const { visitId } = await aVisit(patientId, doctors.maya);
    await recordSession(
      maya.tenant!,
      id,
      visitId,
      treatmentSessionSchema.parse({ note: "Fitted", complete: false, seen: null }),
    );
    await changeTreatmentStatus(
      maya.tenant!,
      id,
      treatmentStatusSchema.parse({ status: "ON_HOLD", seen: "IN_PROGRESS" }),
    );
    await expect(
      recordSession(
        maya.tenant!,
        id,
        visitId,
        treatmentSessionSchema.parse({ note: "Adjusted", complete: true, seen: { note: "Fitted" } }),
      ),
    ).rejects.toMatchObject({ code: "TREATMENT_STATUS_NOT_ALLOWED" });
    const { data: session } = await admin().from("treatment_sessions").select("note").eq("treatment_id", id).single();
    expect(session).toEqual({ note: "Fitted" });
  });
});

describe("changing one, and removing a session (D251, D252, D254, D259)", () => {
  it("saves its details and next sitting from the copy read, and removes a session while the visit is open", async () => {
    const patientId = await addPatient("Farah Khan");
    const { visitId, appointmentId } = await aVisit(patientId, doctors.maya);
    const { id } = await createTreatment(
      maya.tenant!,
      typed(patientId, { visitId, start: "IN_PROGRESS", name: "Root canal", note: "Opened" }),
    );
    expect(
      await updateTreatment(
        maya.tenant!,
        id,
        changeTreatmentSchema.parse({
          part: "DETAILS",
          changes: { name: "Root canal (UL6)", description: "", estimatedCost: "4,500", doctorId: doctors.ravi },
          seen: { name: "Root canal", description: null, estimatedCostPaise: null, doctorId: doctors.maya },
        }),
      ),
    ).toEqual({ name: "Root canal (UL6)", description: null, estimatedCostPaise: 450000, doctorId: doctors.ravi });
    const due = addDaysKey(today, 7);
    expect(
      await updateTreatment(
        maya.tenant!,
        id,
        changeTreatmentSchema.parse({ part: "NEXT_DUE", changes: { nextDueOn: due }, seen: { nextDueOn: null } }),
      ),
    ).toEqual({ nextDueOn: due });
    await expect(
      updateTreatment(
        maya.tenant!,
        id,
        changeTreatmentSchema.parse({ part: "NEXT_DUE", changes: { nextDueOn: "" }, seen: { nextDueOn: null } }),
      ),
    ).rejects.toMatchObject({ code: "TREATMENT_CHANGED" });
    const [, details, next] = await auditsOf(id);
    expect(details.changes).toMatchObject({ estimated_cost_paise: { from: null, to: 450000 }, fields: ["name"] });
    expect(next.changes).toEqual({ next_due_on: { from: null, to: due } });

    // The visit's history names it while its session stands; removed, the visit still began it.
    expect((await listPatientVisits(maya.tenant!, patientId))[0].treatments).toEqual(["Root canal (UL6)"]);
    expect(await removeSession(maya.tenant!, id, visitId)).toEqual({ treatmentId: id, visitId });
    expect((await getVisit(maya.tenant!, visitId)).treatments[0].sessions).toEqual([]);
    expect((await listPatientVisits(maya.tenant!, patientId))[0].treatments).toEqual(["Root canal (UL6)"]);
    await recordSession(
      maya.tenant!,
      id,
      visitId,
      treatmentSessionSchema.parse({ note: "", complete: false, seen: null }),
    );
    await markDone(desk.tenant!, { appointmentId });
    await expect(removeSession(maya.tenant!, id, visitId)).rejects.toMatchObject({ code: "TREATMENT_SESSION_KEPT" });
  });
});
