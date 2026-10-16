import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { backToWaiting, markDone, sendIn } from "@/features/appointments/moves";
import { medicineSuggestions } from "@/features/prescriptions/api";
import { savePrescription } from "@/features/prescriptions/records";
import type { PrescriptionContent } from "@/features/prescriptions/types";
import { getVisit } from "@/features/visits/api";
import {
  medicineSearchSchema,
  savePrescriptionSchema,
  walkInSchema,
  type PrescriptionItemInput,
} from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  settleVisits,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Prescriptions (plan §13, §8.2 rule 4; R6.3, D210 – D217): saved whole by
 * the visit's doctor, or typed for them with prescriptions.write (D45), open
 * or done (D215); refused from an older copy (D206) and until the doctor has
 * a registration number (D213); a prescription with anything on it keeps its
 * visit from Back to waiting (D197). The medicine suggestions are this
 * clinic's lines as last written, the doctor's own first (D211).
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
let desk: Member;
let typist: Member;
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

/** A patient walked in to a doctor and sent in, and their open visit. */
async function inRoom(name: string, doctorId = doctors.A) {
  const patientId = await addPatient(name);
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultation }),
    randomUUID(),
  );
  const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
  return { patientId, appointmentId: arrival.id, visitId };
}

const LINE: PrescriptionItemInput = {
  medicine: "",
  strength: "",
  dose: "",
  frequency: "",
  timing: "",
  durationDays: "",
  instructions: "",
};

const prescription = (
  items: Partial<PrescriptionItemInput>[],
  { advice = "", printDiagnosis = false }: { advice?: string; printDiagnosis?: boolean } = {},
  seen: PrescriptionContent | null = null,
) =>
  savePrescriptionSchema.parse({
    prescription: { items: items.map((item) => ({ ...LINE, ...item })), advice, printDiagnosis },
    seen,
  });

const PARACETAMOL = {
  medicine: "Paracetamol",
  strength: "500 mg",
  dose: "1 tab",
  frequency: "1-0-1",
  timing: "AFTER_FOOD",
  durationDays: "5",
} as const;

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
  [desk, typist, nurse, doctorA, doctorB] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: [...CLINICAL, "prescriptions.write"] }),
    addMember(clinic.clinicId, { permissions: CLINICAL }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: [...CLINICAL, "appointments.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
  ]);
  [doctors.A, doctors.B] = await Promise.all([doctorIdOf(doctorA.memberId), doctorIdOf(doctorB.memberId)]);
  // Doctor A has a registration number; doctor B has none yet (D213).
  await admin().from("doctors").update({ registration_number: "KMC 12345" }).eq("id", doctors.A);
  await admin().from("profiles").update({ full_name: "Priya Nair" }).eq("id", typist.userId);
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

describe("savePrescription (D210, D206)", () => {
  it("is written by the visit's doctor, then typed over by an assistant from the copy read — each audited", async () => {
    const { visitId } = await inRoom("Rohan Mehta");
    const written = await savePrescription(
      doctorA.tenant!,
      visitId,
      prescription([PARACETAMOL, { medicine: "  Cetirizine ", strength: "10 mg", timing: "BEDTIME" }], {
        advice: "Plenty of fluids",
      }),
    );
    expect(written.prescription).toEqual({
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
      advice: "Plenty of fluids",
      printDiagnosis: false,
    });
    let visit = await getVisit(nurse.tenant!, visitId);
    expect(visit.prescription).toMatchObject({ ...written.prescription, typedBy: null });
    expect(visit.doctorRegistration).toBe("KMC 12345");

    // From no copy — someone wrote it meanwhile (D206).
    await expect(savePrescription(typist.tenant!, visitId, prescription([PARACETAMOL]))).rejects.toMatchObject({
      code: "VISIT_CHANGED",
    });

    // The assistant moves Cetirizine first, and ticks the diagnosis to print (D216).
    const typed = await savePrescription(
      typist.tenant!,
      visitId,
      prescription(
        [{ medicine: "Cetirizine", strength: "10 mg", timing: "BEDTIME" }, PARACETAMOL],
        { advice: "Plenty of fluids", printDiagnosis: true },
        written.prescription,
      ),
    );
    expect(typed.prescription.items.map((item) => item.medicine)).toEqual(["Cetirizine", "Paracetamol"]);
    visit = await getVisit(doctorA.tenant!, visitId);
    expect(visit.prescription).toMatchObject({ printDiagnosis: true, typedBy: "Priya Nair" });

    const { id, entered_by } = (
      await admin().from("prescriptions").select("id, entered_by").eq("visit_id", visitId).single()
    ).data!;
    expect(entered_by).toBe(typist.userId);
    expect((await auditsOf(id)).map(({ action, entity_type, changes }) => [action, entity_type, changes])).toEqual([
      ["CREATE", "prescriptions", { print_diagnosis: { from: null, to: false }, fields: ["items", "advice"] }],
      ["UPDATE", "prescriptions", { print_diagnosis: { from: false, to: true }, fields: ["items"] }],
    ]);
  });

  it("writes the medicines again only when they changed, so each keeps when it was written", async () => {
    const { visitId } = await inRoom("Sunil Nair");
    const first = await savePrescription(doctorA.tenant!, visitId, prescription([PARACETAMOL]));
    const writtenAt = async () =>
      (await admin().from("prescription_items").select("id, created_at").eq("clinic_id", clinic.clinicId)).data!;
    const before = await writtenAt();
    await savePrescription(
      doctorA.tenant!,
      visitId,
      prescription([PARACETAMOL], { advice: "Rest" }, first.prescription),
    );
    expect(await writtenAt()).toEqual(before);
  });

  it("is the doctor's or a typist's alone, open or done (D215), within the doctor scope", async () => {
    const patient = await inRoom("Meera Iyer");
    await expect(savePrescription(nurse.tenant!, patient.visitId, prescription([PARACETAMOL]))).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    await expect(savePrescription(doctorB.tenant!, patient.visitId, prescription([PARACETAMOL]))).rejects.toMatchObject(
      { code: "RECORD_NOT_FOUND" },
    );

    await markDone(desk.tenant!, { appointmentId: patient.appointmentId });
    const typed = await savePrescription(typist.tenant!, patient.visitId, prescription([PARACETAMOL]));
    const corrected = await savePrescription(
      doctorA.tenant!,
      patient.visitId,
      prescription([{ ...PARACETAMOL, durationDays: "3" }], {}, typed.prescription),
    );
    expect(corrected.prescription.items[0].durationDays).toBe(3);
    expect((await getVisit(doctorA.tenant!, patient.visitId)).prescription?.typedBy).toBeNull();
  });

  it("waits for the doctor's registration number (D213), and refuses an archived patient", async () => {
    const theirs = await inRoom("Kavya Rao", doctors.B);
    await expect(savePrescription(doctorB.tenant!, theirs.visitId, prescription([PARACETAMOL]))).rejects.toMatchObject({
      code: "PRESCRIPTION_NEEDS_REGISTRATION",
    });
    expect((await getVisit(doctorB.tenant!, theirs.visitId)).doctorRegistration).toBeNull();

    const patient = await inRoom("Anil Kumar");
    await markDone(desk.tenant!, { appointmentId: patient.appointmentId });
    await settleVisits(patient.patientId);
    const { error } = await admin()
      .from("patients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", patient.patientId);
    expect(error).toBeNull();
    await expect(savePrescription(doctorA.tenant!, patient.visitId, prescription([PARACETAMOL]))).rejects.toMatchObject(
      { code: "PATIENT_ARCHIVED" },
    );
  });

  it("holds each line to its column, and at most 30 medicines", async () => {
    const { visitId } = await inRoom("Gita Shah");
    const { error } = await doctorA.tenant!.supabase.rpc("save_prescription", {
      p_visit_id: visitId,
      p_prescription: { items: [{ medicine: "Paracetamol", timing: "AT_NOON" }], advice: null, print_diagnosis: false },
      p_seen: null,
    });
    expect(error?.code).toBe("23514");
    const { error: days } = await doctorA.tenant!.supabase.rpc("save_prescription", {
      p_visit_id: visitId,
      p_prescription: {
        items: [{ medicine: "Paracetamol", duration_days: 400 }],
        advice: null,
        print_diagnosis: false,
      },
      p_seen: null,
    });
    expect(days?.code).toBe("23514");
    const { error: many } = await doctorA.tenant!.supabase.rpc("save_prescription", {
      p_visit_id: visitId,
      p_prescription: {
        items: Array.from({ length: 31 }, () => ({ medicine: "Paracetamol" })),
        advice: null,
        print_diagnosis: false,
      },
      p_seen: null,
    });
    expect(many?.hint).toBe("VALIDATION_ERROR");
  });

  it("keeps a visit with a prescription from Back to waiting, and removes it once the prescription is emptied (D197)", async () => {
    const patient = await inRoom("Hari Prasad");
    const written = await savePrescription(doctorA.tenant!, patient.visitId, prescription([PARACETAMOL]));
    await backToWaiting(desk.tenant!, { appointmentId: patient.appointmentId });
    expect((await admin().from("visits").select("id").eq("id", patient.visitId)).data).toHaveLength(1);

    await sendIn(desk.tenant!, { appointmentId: patient.appointmentId, others: "KEEP" });
    await savePrescription(doctorA.tenant!, patient.visitId, prescription([], {}, written.prescription));
    await backToWaiting(desk.tenant!, { appointmentId: patient.appointmentId });
    expect((await admin().from("visits").select("id").eq("id", patient.visitId)).data).toEqual([]);
    expect((await admin().from("prescriptions").select("id").eq("visit_id", patient.visitId)).data).toEqual([]);
  });
});

describe("medicineSuggestions (D211)", () => {
  const search = (q: string, doctorId = doctors.A) => medicineSearchSchema.parse({ q, doctorId });

  it("finds this clinic's medicines by their beginning, one for each strength, the doctor's own line first", async () => {
    // Doctor A writes Amoxicillin 500 mg one way; the assistant types it for A's patient another way, later.
    const first = await inRoom("Isha Gupta");
    await savePrescription(
      doctorA.tenant!,
      first.visitId,
      prescription([{ medicine: "Amoxicillin", strength: "500 mg", frequency: "1-1-1", durationDays: "5" }]),
    );
    const second = await inRoom("Jaya Menon");
    await savePrescription(
      typist.tenant!,
      second.visitId,
      prescription([
        { medicine: "amoxicillin", strength: "500 MG", frequency: "1-0-1", durationDays: "7" },
        { medicine: "Amoxicillin", strength: "250 mg", frequency: "SOS" },
        { medicine: "Azithromycin", strength: "500 mg" },
      ]),
    );

    const found = await medicineSuggestions(typist.tenant!, search("AMOX"));
    // Written at the same moment, they come by name.
    expect(found.map((line) => [line.medicine, line.strength, line.frequency])).toEqual([
      ["Amoxicillin", "250 mg", "SOS"],
      ["amoxicillin", "500 MG", "1-0-1"],
    ]);
    // Typed for doctor A's patient, each line is doctor A's own: the newest of each is what fills.
    expect(found[1]).toEqual({
      medicine: "amoxicillin",
      strength: "500 MG",
      dose: null,
      frequency: "1-0-1",
      timing: null,
      durationDays: 7,
      instructions: null,
    });
  });

  it("puts the doctor's own line before another doctor's, and takes what is typed literally", async () => {
    await admin().from("doctors").update({ registration_number: "KMC 67890" }).eq("id", doctors.B);
    const mine = await inRoom("Lata Bose", doctors.B);
    await savePrescription(
      doctorB.tenant!,
      mine.visitId,
      prescription([{ medicine: "Pantoprazole", strength: "40 mg", timing: "EMPTY_STOMACH" }]),
    );
    const theirs = await inRoom("Mohan Das");
    await savePrescription(
      doctorA.tenant!,
      theirs.visitId,
      prescription([{ medicine: "Pantoprazole", strength: "40 mg", timing: "BEFORE_FOOD" }]),
    );
    expect((await medicineSuggestions(doctorB.tenant!, search("panto", doctors.B)))[0].timing).toBe("EMPTY_STOMACH");
    expect((await medicineSuggestions(doctorA.tenant!, search("panto")))[0].timing).toBe("BEFORE_FOOD");
    expect(await medicineSuggestions(doctorA.tenant!, search("pan%"))).toEqual([]);
    expect(await medicineSuggestions(doctorA.tenant!, search("_anto"))).toEqual([]);
  });

  it("is for a doctor or whoever types for one", async () => {
    await expect(medicineSuggestions(nurse.tenant!, search("par"))).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    await expect(medicineSuggestions(desk.tenant!, search("par"))).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});
