import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { savePrescription } from "@/features/prescriptions/records";
import { templatesKey } from "@/features/prescriptions/keys";
import { addTemplate, changeTemplate, listTemplates, ownTemplates } from "@/features/prescriptions/templates";
import { getVisit } from "@/features/visits/api";
import {
  changeTemplateSchema,
  savePrescriptionSchema,
  saveTemplateSchema,
  walkInSchema,
  type PrescriptionItemInput,
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
 * Prescription templates and Repeat (plan §13; R6.7, D236 – D243): a
 * doctor's own templates, made, changed, archived and restored by them alone
 * (D240, D242), read by whoever types for them (D241); a name in use is
 * replaced only once asked (D243). Repeat's prescription is the patient's
 * latest with a medicine, from the visits before this one, by any doctor,
 * read with the visit (D236).
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = ["patients.view", "patients.create", "appointments.view", "appointments.create"];
const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];

let clinic: TestClinic;
let desk: Member;
let typist: Member;
let nurse: Member;
let maya: Member;
let ravi: Member;
const doctors = { maya: "", ravi: "" };
let consultation: string;

const doctorIdOf = async (memberId: string) =>
  (await admin().from("doctors").select("id").eq("member_id", memberId).single()).data!.id as string;

const LINE: PrescriptionItemInput = {
  medicine: "",
  strength: "",
  dose: "",
  frequency: "",
  timing: "",
  durationDays: "",
  instructions: "",
};

const PARACETAMOL = {
  medicine: "Paracetamol",
  strength: "500 mg",
  dose: "1 tab",
  frequency: "1-0-1",
  timing: "AFTER_FOOD",
  durationDays: "5",
} as const;

/** A new template, as its route parses it. */
const aTemplate = (
  name: string,
  items: Partial<PrescriptionItemInput>[],
  { advice = "", replace = false }: { advice?: string; replace?: boolean } = {},
) =>
  saveTemplateSchema.parse({
    template: { name, items: items.map((item) => ({ ...LINE, ...item })), advice },
    replace,
  });

/** A change to a template's contents, as its route parses it. */
const changed = (name: string, items: Partial<PrescriptionItemInput>[], advice = "") =>
  changeTemplateSchema.parse({ template: { name, items: items.map((item) => ({ ...LINE, ...item })), advice } });

const auditsOf = async (entityId: string) =>
  (
    await admin()
      .from("audit_logs")
      .select("action, entity_type, changes")
      .eq("entity_id", entityId)
      .order("created_at")
  ).data!;

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

const prescribe = (writer: Member, visitId: string, items: Partial<PrescriptionItemInput>[], advice = "") =>
  savePrescription(
    writer.tenant!,
    visitId,
    savePrescriptionSchema.parse({
      prescription: { items: items.map((item) => ({ ...LINE, ...item })), advice, printDiagnosis: false },
      seen: null,
    }),
  );

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, typist, nurse, maya, ravi] = await Promise.all([
    addMember(clinic.clinicId, { permissions: [...DESK, "appointments.edit"] }),
    addMember(clinic.clinicId, { permissions: [...CLINICAL, "prescriptions.write"] }),
    addMember(clinic.clinicId, { permissions: CLINICAL }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
  ]);
  [doctors.maya, doctors.ravi] = await Promise.all([doctorIdOf(maya.memberId), doctorIdOf(ravi.memberId)]);
  await Promise.all([
    admin().from("doctors").update({ registration_number: "KMC 12345" }).in("id", [doctors.maya, doctors.ravi]),
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId),
    admin().from("profiles").update({ full_name: "Ravi Kumar" }).eq("id", ravi.userId),
  ]);
  consultation = (
    await admin()
      .from("appointment_types")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .single()
  ).data!.id as string;
});

/** Ends everyone still in, so each test starts with the rooms free. */
beforeEach(async () => {
  const { data } = await admin()
    .from("appointments")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("status", "IN_PROGRESS");
  for (const { id } of data ?? []) await markDone(desk.tenant!, { appointmentId: id });
});

afterAll(removeAll);

describe("a doctor's templates (D240, D242)", () => {
  it("are made whole by the doctor — the medicines in order, the text cleaned — and audited by name", async () => {
    const made = await addTemplate(
      maya.tenant!,
      aTemplate("  Viral   fever ", [PARACETAMOL, { medicine: "Cetirizine", strength: "10 mg", timing: "BEDTIME" }], {
        advice: "Plenty of fluids",
      }),
      "req_template",
    );
    expect(made).toEqual({
      id: expect.any(String),
      name: "Viral fever",
      advice: "Plenty of fluids",
      active: true,
      items: [
        {
          medicine: "Paracetamol",
          strength: "500 mg",
          dose: "1 tab",
          frequency: "1-0-1",
          timing: "AFTER_FOOD",
          durationDays: 5,
          instructions: null,
        },
        {
          medicine: "Cetirizine",
          strength: "10 mg",
          dose: null,
          frequency: null,
          timing: "BEDTIME",
          durationDays: null,
          instructions: null,
        },
      ],
    });
    const { data: row } = await admin().from("prescription_templates").select("*").eq("id", made.id).single();
    expect(row).toMatchObject({ clinic_id: clinic.clinicId, doctor_id: doctors.maya, created_by: maya.userId });
    expect(await auditsOf(made.id)).toEqual([
      {
        action: "CREATE",
        entity_type: "prescription_templates",
        changes: { name: { from: null, to: "Viral fever" }, fields: ["items", "advice"] },
      },
    ]);
    expect(await listTemplates(maya.tenant!, doctors.maya)).toContainEqual(made);
  });

  it("hold advice alone, but not nothing", async () => {
    const advice = await addTemplate(maya.tenant!, aTemplate("Post-extraction", [], { advice: "Cold food for a day" }));
    expect(advice).toMatchObject({ name: "Post-extraction", items: [], advice: "Cold food for a day" });
    const { error } = await maya.tenant!.supabase.rpc("save_prescription_template", {
      p_template_id: null,
      p_template: { name: "Empty", items: [], advice: null },
      p_replace: false,
    });
    expect(error?.hint).toBe("VALIDATION_ERROR");
  });

  it("ask before a new one replaces another of the same name, and replace it only when told (D243)", async () => {
    const first = await addTemplate(maya.tenant!, aTemplate("Gum care", [PARACETAMOL], { advice: "Salt water" }));
    await expect(
      addTemplate(maya.tenant!, aTemplate("GUM CARE", [{ medicine: "Chlorhexidine" }])),
    ).rejects.toMatchObject({ code: "TEMPLATE_NAME_TAKEN", kind: "CONFLICT" });
    const replaced = await addTemplate(
      maya.tenant!,
      aTemplate("GUM CARE", [{ medicine: "Chlorhexidine" }], { replace: true }),
    );
    expect(replaced).toMatchObject({ id: first.id, name: "GUM CARE", advice: null });
    expect(replaced.items.map((item) => item.medicine)).toEqual(["Chlorhexidine"]);
    expect((await auditsOf(first.id)).map((row) => row.action)).toEqual(["CREATE", "UPDATE"]);
    // Another doctor's name is no clash: a name is one doctor's own.
    const ravis = await addTemplate(ravi.tenant!, aTemplate("Gum care", [PARACETAMOL]));
    expect(ravis.id).not.toBe(first.id);
  });

  it("are changed by their doctor, keeping to a name of their own, and audited by what changed", async () => {
    const [cough] = await Promise.all([
      addTemplate(maya.tenant!, aTemplate("Cough", [{ medicine: "Ambroxol" }])),
      addTemplate(maya.tenant!, aTemplate("Cold", [{ medicine: "Cetirizine" }])),
    ]);
    await expect(
      changeTemplate(maya.tenant!, cough.id, changed("cold", [{ medicine: "Ambroxol" }])),
    ).rejects.toMatchObject({ code: "TEMPLATE_NAME_TAKEN" });
    const renamed = await changeTemplate(maya.tenant!, cough.id, changed("Dry cough", [{ medicine: "Ambroxol" }]));
    expect(renamed).toMatchObject({ id: cough.id, name: "Dry cough", active: true });
    const unchanged = await changeTemplate(maya.tenant!, cough.id, changed("Dry cough", [{ medicine: "Ambroxol" }]));
    expect(unchanged).toEqual(renamed);
    expect((await auditsOf(cough.id)).map(({ action, changes }) => [action, changes])).toEqual([
      ["CREATE", { name: { from: null, to: "Cough" }, fields: ["items"] }],
      ["UPDATE", { name: { from: "Cough", to: "Dry cough" } }],
    ]);
  });

  it("are archived, freeing the name, and restored only while no other in use has it", async () => {
    const old = await addTemplate(maya.tenant!, aTemplate("Fever", [PARACETAMOL]));
    const archived = await changeTemplate(maya.tenant!, old.id, { active: false });
    expect(archived).toMatchObject({ id: old.id, active: false });
    const fresh = await addTemplate(maya.tenant!, aTemplate("Fever", [{ medicine: "Dolo" }]));
    expect(fresh.id).not.toBe(old.id);
    await expect(changeTemplate(maya.tenant!, old.id, { active: true })).rejects.toMatchObject({
      code: "TEMPLATE_NAME_TAKEN",
    });
    await changeTemplate(maya.tenant!, fresh.id, { active: false });
    expect(await changeTemplate(maya.tenant!, old.id, { active: true })).toMatchObject({ active: true });
    expect((await auditsOf(old.id)).map(({ action, changes }) => [action, changes])).toEqual([
      ["CREATE", { name: { from: null, to: "Fever" }, fields: ["items"] }],
      ["ARCHIVE", { active: { from: true, to: false } }],
      ["RESTORE", { active: { from: false, to: true } }],
    ]);
  });

  it("are the doctor's own screens' first read, and nothing for anyone else", async () => {
    const reads = ownTemplates(maya.tenant!);
    const key = templatesKey(doctors.maya);
    expect(Object.keys(reads)).toEqual([key]);
    await expect(reads[key](maya.tenant!)).resolves.toEqual(await listTemplates(maya.tenant!, doctors.maya));
    expect(ownTemplates(typist.tenant!)).toEqual({});
  });
});

describe("who reaches a doctor's templates (D240, D241)", () => {
  let template: string;

  beforeAll(async () => {
    template = (await addTemplate(maya.tenant!, aTemplate("Sinusitis", [{ medicine: "Amoxicillin" }]))).id;
  });

  it("reads them for the doctor and whoever types for them, and for no one else", async () => {
    const theirs = (await listTemplates(maya.tenant!, doctors.maya)).map(({ id }) => id);
    expect(theirs).toContain(template);
    expect((await listTemplates(typist.tenant!, doctors.maya)).map(({ id }) => id)).toEqual(theirs);
    expect(await listTemplates(ravi.tenant!, doctors.maya)).toEqual([]);
    expect(await listTemplates(nurse.tenant!, doctors.maya)).toEqual([]);
    expect(await listTemplates(desk.tenant!, doctors.maya)).toEqual([]);
    for (const table of ["prescription_templates", "prescription_template_items"]) {
      const { data } = await nurse.tenant!.supabase.from(table).select("id");
      expect(data, table).toEqual([]);
    }
    // In order, by name, case aside.
    const names = (await listTemplates(maya.tenant!, doctors.maya)).map(({ name }) => name.toLowerCase());
    expect(names).toEqual([...names].sort());
  });

  it("lets no one else make, change, archive or restore one", async () => {
    await expect(addTemplate(typist.tenant!, aTemplate("Typed", [PARACETAMOL]))).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    await expect(addTemplate(clinic.owner.tenant, aTemplate("Owned", [PARACETAMOL]))).resolves.toMatchObject({
      name: "Owned",
    });
    for (const other of [typist, ravi]) {
      await expect(changeTemplate(other.tenant!, template, changed("Planted", [PARACETAMOL]))).rejects.toMatchObject({
        code: other === typist ? "AUTH_PERMISSION_DENIED" : "RECORD_NOT_FOUND",
      });
      await expect(changeTemplate(other.tenant!, template, { active: false })).rejects.toMatchObject({
        code: "RECORD_NOT_FOUND",
      });
    }
    const { data: planted } = await typist
      .tenant!.supabase.from("prescription_templates")
      .update({ name: "Planted" })
      .eq("id", template)
      .select("id");
    expect(planted ?? []).toEqual([]);
    const { error: inserted } = await maya
      .tenant!.supabase.from("prescription_template_items")
      .insert({ clinic_id: clinic.clinicId, template_id: template, position: 9, medicine: "Planted" });
    expect(inserted?.code).toBe("42501");
    const { data: row } = await admin()
      .from("prescription_templates")
      .select("name, active")
      .eq("id", template)
      .single();
    expect(row).toEqual({ name: "Sinusitis", active: true });
  });
});

describe("Repeat's prescription, read with the visit (D236)", () => {
  it("is the latest with a medicine, from the visits before this one, by any doctor — none before the first", async () => {
    const patientId = await addPatient("Anita Rao");
    const first = await aVisit(patientId, doctors.maya);
    await prescribe(maya, first.visitId, [PARACETAMOL, { medicine: "Cetirizine" }], "Rest");
    expect((await getVisit(maya.tenant!, first.visitId)).previousPrescription).toBeNull();
    await markDone(desk.tenant!, { appointmentId: first.appointmentId });

    // A later visit whose prescription holds advice alone is passed over.
    const second = await aVisit(patientId, doctors.ravi);
    await prescribe(ravi, second.visitId, [], "Steam twice a day");
    await markDone(desk.tenant!, { appointmentId: second.appointmentId });

    const third = await aVisit(patientId, doctors.ravi);
    const visit = await getVisit(ravi.tenant!, third.visitId);
    expect(visit.previousPrescription).toEqual({
      day: visit.day,
      doctorName: "Maya Rao",
      advice: "Rest",
      items: [
        {
          medicine: "Paracetamol",
          strength: "500 mg",
          dose: "1 tab",
          frequency: "1-0-1",
          timing: "AFTER_FOOD",
          durationDays: 5,
          instructions: null,
        },
        {
          medicine: "Cetirizine",
          strength: null,
          dose: null,
          frequency: null,
          timing: null,
          durationDays: null,
          instructions: null,
        },
      ],
    });
    // A later prescription is not "before": the first visit still has none.
    await prescribe(ravi, third.visitId, [{ medicine: "Dolo" }]);
    expect((await getVisit(maya.tenant!, first.visitId)).previousPrescription).toBeNull();
    // Whoever types for the doctor reads it too.
    expect((await getVisit(typist.tenant!, third.visitId)).previousPrescription?.doctorName).toBe("Maya Rao");
  });

  it("is never another patient's", async () => {
    const [kiran, meena] = await Promise.all([addPatient("Kiran Shah"), addPatient("Meena Iyer")]);
    const theirs = await aVisit(kiran, doctors.maya);
    await prescribe(maya, theirs.visitId, [PARACETAMOL]);
    await markDone(desk.tenant!, { appointmentId: theirs.appointmentId });
    const hers = await aVisit(meena, doctors.maya);
    expect((await getVisit(maya.tenant!, hers.visitId)).previousPrescription).toBeNull();
  });
});
