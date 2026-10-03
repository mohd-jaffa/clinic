import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { FIRST_PATIENT_NUMBER } from "@/constants/seeds";
import { createPatient, findPatientMatches, getPatient, updatePatient } from "@/features/patients/api";
import { estimatedBirthDate } from "@/lib/dates/age";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { patientSchema, type PatientInput } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  setMemberStatus,
  setValidUntil,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Patients in the database itself (plan §10, §27.3; R4.1, D98 – D104), each
 * member going straight at it with their own token, as the routes will: the
 * clinic's own numbers; the doctor scope — the assigned doctor and the one
 * who added the patient, the list only growing; an archived patient
 * read-only until restored; the date of birth and the assigned doctor
 * checked; the search, best match first; alerts within the scope; and
 * nothing written while the clinic is view-only.
 */
type Member = SignedIn & { memberId: string };
interface PatientRow {
  id: string;
  patient_number: number;
  full_name: string;
  phone: string;
  assigned_doctor_id: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_by: string | null;
}

const DOCTOR: Permission[] = ["patients.view", "patients.create", "patients.edit", "visits.view", "visits.edit"];
const RECEPTIONIST: Permission[] = ["patients.view", "patients.create", "patients.edit"];
const ASSISTANT: Permission[] = ["patients.view", "visits.view", "visits.edit"];

let clinic: TestClinic;
let other: TestClinic;
let receptionist: Member;
let assistant: Member;
let bookkeeper: Member;
let doctorA: Member;
let doctorB: Member;
let doctorC: Member;
const doctorIds: Record<"A" | "B" | "C", string> = { A: "", B: "", C: "" };

const today = todayKey();
const patient = (overrides: Record<string, unknown> = {}) => ({
  full_name: "Rohan Mehta",
  phone: "+919876543210",
  date_of_birth: "1990-04-12",
  gender: "MALE",
  ...overrides,
});

const supabaseOf = (member: SignedIn) => member.tenant!.supabase;

const add = (member: SignedIn, overrides: Record<string, unknown> = {}, key: string = randomUUID()) =>
  supabaseOf(member)
    .rpc("create_patient", { p_patient: patient(overrides), p_idempotency_key: key })
    .single<{ patient_id: string; created: boolean }>();

async function create(member: SignedIn, overrides: Record<string, unknown> = {}): Promise<PatientRow> {
  const { data, error } = await add(member, overrides);
  if (error) throw error;
  const { data: row } = await admin().from("patients").select("*").eq("id", data.patient_id).single<PatientRow>();
  return row!;
}

async function refusal(member: SignedIn, overrides: Record<string, unknown>) {
  return (await add(member, overrides)).error;
}

/** What a member reads of a patient: the row, or null when it is hidden from them. */
async function seen(member: SignedIn, id: string) {
  const { data } = await supabaseOf(member).from("patients").select("id").eq("id", id).maybeSingle();
  return data;
}

const update = (member: SignedIn, id: string, patch: Record<string, unknown>) =>
  supabaseOf(member).from("patients").update(patch).eq("id", id).select("*").maybeSingle<PatientRow>();

const doctorIdOf = async (memberId: string) => {
  const { data } = await admin().from("doctors").select("id").eq("member_id", memberId).single();
  return data!.id as string;
};

beforeAll(async () => {
  [clinic, other] = await Promise.all([
    registerClinic({ fullName: "Asha Menon" }),
    registerClinic({ fullName: "Ravi Kumar" }),
  ]);
  [receptionist, assistant, bookkeeper, doctorA, doctorB, doctorC] = await Promise.all([
    addMember(clinic.clinicId, { permissions: RECEPTIONIST }),
    addMember(clinic.clinicId, { permissions: ASSISTANT }),
    addMember(clinic.clinicId, { permissions: ["expenses.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: DOCTOR }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: DOCTOR }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: DOCTOR }),
  ]);
  [doctorIds.A, doctorIds.B, doctorIds.C] = await Promise.all(
    [doctorA, doctorB, doctorC].map(({ memberId }) => doctorIdOf(memberId)),
  );
});

afterAll(removeAll);

describe("the clinic's own numbers (plan §10.1)", () => {
  it("numbers a clinic's patients from FIRST_PATIENT_NUMBER, one after the other", async () => {
    const first = await create(receptionist, { full_name: "Anil Shah" });
    const second = await create(clinic.owner, { full_name: "Bina Shah" });
    expect(first.patient_number).toBe(FIRST_PATIENT_NUMBER);
    expect(second.patient_number).toBe(FIRST_PATIENT_NUMBER + 1);
    expect(first.created_by).toBe(receptionist.userId);
  });

  it("gives patients added at the same moment a number each", async () => {
    const added = await Promise.all(
      Array.from({ length: 6 }, (_, index) => create(receptionist, { full_name: `Twin ${index + 1}` })),
    );
    const numbers = added.map(({ patient_number }) => patient_number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 6 }, (_, index) => FIRST_PATIENT_NUMBER + 2 + index));
  });

  it("counts each clinic on its own", async () => {
    expect((await create(other.owner)).patient_number).toBe(FIRST_PATIENT_NUMBER);
  });

  it("adds one patient for one key, however often it is sent, and a key is needed", async () => {
    const key = randomUUID();
    const [first, again] = await Promise.all([
      add(receptionist, { full_name: "Double Tap" }, key),
      add(receptionist, { full_name: "Double Tap" }, key),
    ]);
    expect(first.data!.patient_id).toBe(again.data!.patient_id);
    expect([first.data!.created, again.data!.created].sort()).toEqual([false, true]);
    const { data } = await admin().from("patients").select("id").eq("idempotency_key", key);
    expect(data).toHaveLength(1);
    const { error } = await supabaseOf(receptionist).rpc("create_patient", {
      p_patient: patient(),
      p_idempotency_key: null,
    });
    expect(error?.hint).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("never lets a client set a number, or read the counter", async () => {
    const mine = await create(receptionist);
    const { error } = await update(clinic.owner, mine.id, { patient_number: 1 });
    expect(error?.code).toBe("42501");
    const { error: counter } = await supabaseOf(clinic.owner).from("patient_counters").select("*");
    expect(counter?.code).toBe("42501");
  });

  it("takes a mobile more than once: families share one (Q7)", async () => {
    const phone = "+919900000001";
    await create(receptionist, { full_name: "Mother", phone });
    await create(receptionist, { full_name: "Daughter", phone, gender: "FEMALE" });
    const { data } = await supabaseOf(receptionist).from("patients").select("full_name").eq("phone", phone);
    expect(data!.map(({ full_name }) => full_name).sort()).toEqual(["Daughter", "Mother"]);
  });
});

describe("who may add one", () => {
  it("needs patients.create", async () => {
    expect((await refusal(assistant, {}))?.hint).toBe("AUTH_PERMISSION_DENIED");
    expect((await refusal(bookkeeper, {}))?.hint).toBe("AUTH_PERMISSION_DENIED");
  });

  it("never holds adding or editing without seeing (D102)", async () => {
    for (const permissions of [["patients.create"], ["patients.edit"]]) {
      const { error } = await admin().from("clinic_members").update({ permissions }).eq("id", bookkeeper.memberId);
      expect(error?.code, permissions[0]).toBe("23514");
    }
  });
});

describe("the doctor scope (D3, D99)", () => {
  let shared: PatientRow;

  beforeAll(async () => {
    shared = await create(doctorA, { full_name: "Kiran Rao", assigned_doctor_id: doctorIds.B });
  });

  it("shows a patient to their assigned doctor, and to the doctor who added them", async () => {
    expect(await seen(doctorA, shared.id)).not.toBeNull();
    expect(await seen(doctorB, shared.id)).not.toBeNull();
    expect(await seen(doctorC, shared.id)).toBeNull();
  });

  it("shows every patient to the owner and to staff with patients.view; none without it", async () => {
    expect(await seen(clinic.owner, shared.id)).not.toBeNull();
    expect(await seen(receptionist, shared.id)).not.toBeNull();
    expect(await seen(assistant, shared.id)).not.toBeNull();
    expect(await seen(bookkeeper, shared.id)).toBeNull();
    expect(await seen(other.owner, shared.id)).toBeNull();
  });

  it("answers can_see_patient the same way", async () => {
    const can = async (member: SignedIn) =>
      (await supabaseOf(member).rpc("can_see_patient", { p_patient_id: shared.id })).data;
    expect(await can(doctorA)).toBe(true);
    expect(await can(doctorB)).toBe(true);
    expect(await can(doctorC)).toBe(false);
    expect(await can(clinic.owner)).toBe(true);
    expect(await can(bookkeeper)).toBe(false);
    expect(await can(other.owner)).toBe(false);
  });

  it("only grows: a new assigned doctor joins, and the others keep the patient", async () => {
    const { data, error } = await update(receptionist, shared.id, { assigned_doctor_id: doctorIds.C });
    expect(error).toBeNull();
    expect(data!.assigned_doctor_id).toBe(doctorIds.C);
    for (const doctor of [doctorA, doctorB, doctorC]) expect(await seen(doctor, shared.id)).not.toBeNull();
  });

  it("lets a doctor change none of another doctor's patients", async () => {
    const theirs = await create(receptionist, { full_name: "Leela Iyer", assigned_doctor_id: doctorIds.B });
    const { data } = await update(doctorA, theirs.id, { full_name: "Changed" });
    expect(data).toBeNull();
    expect(await seen(doctorA, theirs.id)).toBeNull();
  });

  it("keeps the access list from every client", async () => {
    const { error } = await supabaseOf(doctorA).from("patient_doctors").select("*");
    expect(error?.code).toBe("42501");
  });
});

describe("what is checked of a patient", () => {
  it(`takes a date of birth from today back to ${estimatedBirthDate(120, today)} — never later, never earlier`, async () => {
    expect((await refusal(receptionist, { date_of_birth: addDaysKey(today, 1) }))?.hint).toBe(
      "PATIENT_BIRTH_DATE_INVALID",
    );
    expect((await refusal(receptionist, { date_of_birth: addDaysKey(estimatedBirthDate(120, today), -1) }))?.hint).toBe(
      "PATIENT_BIRTH_DATE_INVALID",
    );
    const newborn = await create(receptionist, { date_of_birth: today });
    const eldest = await create(receptionist, {
      date_of_birth: estimatedBirthDate(120, today),
      dob_is_estimated: true,
    });
    expect([newborn.id, eldest.id]).toHaveLength(2);
    const { error } = await update(receptionist, newborn.id, { date_of_birth: addDaysKey(today, 2) });
    expect(error?.hint).toBe("PATIENT_BIRTH_DATE_INVALID");
  });

  it("takes as assigned doctor only one of the clinic's active doctors", async () => {
    const leaving = await addMember(clinic.clinicId, { role: "DOCTOR", permissions: DOCTOR });
    const leavingId = await doctorIdOf(leaving.memberId);
    const kept = await create(receptionist, { assigned_doctor_id: leavingId });
    await setMemberStatus(leaving.memberId, "INACTIVE");

    expect((await refusal(receptionist, { assigned_doctor_id: leavingId }))?.hint).toBe("DOCTOR_INACTIVE");
    const { error: moved } = await update(receptionist, (await create(receptionist)).id, {
      assigned_doctor_id: leavingId,
    });
    expect(moved?.hint).toBe("DOCTOR_INACTIVE");
    // A patient whose doctor has left is still changed as usual.
    const { data, error } = await update(receptionist, kept.id, { full_name: "Still Theirs" });
    expect(error).toBeNull();
    expect(data!.assigned_doctor_id).toBe(leavingId);

    const { error: elsewhere } = await add(other.owner, { assigned_doctor_id: doctorIds.A });
    expect(elsewhere?.code).toBe("23503");
  });

  it("refuses a field the form would refuse", async () => {
    for (const overrides of [
      { full_name: "  " },
      { phone: "98765" },
      { gender: "UNKNOWN" },
      { email: "not-an-email" },
      { alt_phone: "call me" },
    ]) {
      expect((await refusal(receptionist, overrides))?.code, JSON.stringify(overrides)).toBe("23514");
    }
  });
});

describe("archived, never deleted (D103)", () => {
  let archived: PatientRow;

  beforeAll(async () => {
    archived = await create(receptionist, { full_name: "Gone Away" });
  });

  it("is archived with patients.edit, stamped with when and by whom whatever was sent", async () => {
    const { data: refused } = await update(assistant, archived.id, { archived_at: new Date().toISOString() });
    expect(refused).toBeNull();

    const before = Date.now();
    const { data, error } = await update(receptionist, archived.id, { archived_at: "2000-01-01T00:00:00Z" });
    expect(error).toBeNull();
    expect(Date.parse(data!.archived_at!)).toBeGreaterThanOrEqual(before - 5_000);
    expect(data!.archived_by).toBe(receptionist.userId);
  });

  it("is read-only until restored: its details and its alerts", async () => {
    const { error } = await update(receptionist, archived.id, { full_name: "Changed" });
    expect(error?.hint).toBe("PATIENT_ARCHIVED");
    const { error: again } = await update(receptionist, archived.id, { archived_at: new Date().toISOString() });
    expect(again?.hint).toBe("PATIENT_ARCHIVED");
    const { error: alert } = await supabaseOf(assistant)
      .from("patient_alerts")
      .insert({ clinic_id: clinic.clinicId, patient_id: archived.id, kind: "ALLERGY", label: "Penicillin" });
    expect(alert?.hint).toBe("PATIENT_ARCHIVED");
  });

  it("is restored, and changed again", async () => {
    const { data } = await update(receptionist, archived.id, { archived_at: null, full_name: "Back Again" });
    expect(data).toMatchObject({ archived_at: null, archived_by: null, full_name: "Back Again" });
  });

  it("is never deleted", async () => {
    const { data } = await supabaseOf(clinic.owner).from("patients").delete().eq("id", archived.id).select("id");
    expect(data ?? []).toEqual([]);
    expect(await seen(clinic.owner, archived.id)).not.toBeNull();
  });
});

describe("the search (plan §10.2; D104)", () => {
  let search: TestClinic;
  let doctor: Member;
  const numbers: Record<string, number> = {};

  const find = async (
    member: SignedIn,
    terms: { words?: string; digits?: string; number?: number; archived?: boolean; offset?: number; limit?: number },
  ) => {
    const { data, error } = await supabaseOf(member).rpc("search_patients", {
      p_words: terms.words ?? null,
      p_digits: terms.digits ?? null,
      p_number: terms.number ?? null,
      p_archived: terms.archived ?? false,
      p_offset: terms.offset ?? 0,
      p_limit: terms.limit ?? 20,
    });
    if (error) throw error;
    return (data as PatientRow[]).map(({ full_name }) => full_name);
  };

  beforeAll(async () => {
    search = await registerClinic({ fullName: "Mohan Das" });
    doctor = await addMember(search.clinicId, { role: "DOCTOR", permissions: DOCTOR });
    const doctorId = await doctorIdOf(doctor.memberId);
    for (const [name, phone, assigned] of [
      ["Ramesh Kumar", "+919812345678", null],
      ["Suresh Raman", "+919811111111", doctorId],
      ["Priya Nair", "+919800011122", null],
      ["Rameshwari Devi", "+919822222222", doctorId],
      ["Old Friend", "+919833333333", null],
    ] as const) {
      const row = await create(search.owner, { full_name: name, phone, assigned_doctor_id: assigned });
      numbers[name] = row.patient_number;
    }
    const { data: old } = await supabaseOf(search.owner)
      .from("patients")
      .select("id")
      .eq("full_name", "Old Friend")
      .single();
    await update(search.owner, old!.id, { archived_at: new Date().toISOString() });
  });

  it("lists the patients newest first with nothing typed, the archived on their own", async () => {
    expect(await find(search.owner, {})).toEqual(["Rameshwari Devi", "Priya Nair", "Suresh Raman", "Ramesh Kumar"]);
    expect(await find(search.owner, { archived: true })).toEqual(["Old Friend"]);
  });

  it("puts names that start with the words first, then those that hold them", async () => {
    expect(await find(search.owner, { words: "ram" })).toEqual(["Rameshwari Devi", "Ramesh Kumar", "Suresh Raman"]);
  });

  it("finds a name with a letter wrong", async () => {
    expect(await find(search.owner, { words: "Rmesh Kumar" })).toContain("Ramesh Kumar");
  });

  it("finds a mobile by its digits, and a patient by their number, that one first", async () => {
    expect(await find(search.owner, { words: "98000 11122", digits: "9800011122" })).toEqual(["Priya Nair"]);
    expect(await find(search.owner, { words: "345", digits: "345" })).toEqual(["Ramesh Kumar"]);
    const number = numbers["Ramesh Kumar"];
    expect((await find(search.owner, { words: `P-${number}`, digits: String(number), number }))[0]).toBe(
      "Ramesh Kumar",
    );
  });

  it("pages", async () => {
    expect(await find(search.owner, { offset: 1, limit: 2 })).toEqual(["Priya Nair", "Suresh Raman"]);
  });

  it("finds a doctor only their own patients", async () => {
    expect(await find(doctor, {})).toEqual(["Rameshwari Devi", "Suresh Raman"]);
    expect(await find(doctor, { words: "ram" })).toEqual(["Rameshwari Devi", "Suresh Raman"]);
  });

  it("finds nothing of another clinic", async () => {
    expect(await find(clinic.owner, { words: "Ramesh" })).toEqual([]);
  });
});

describe("alerts (plan §10.4)", () => {
  let mine: PatientRow;
  const alerts = (member: SignedIn) => supabaseOf(member).from("patient_alerts");
  const alert = (overrides: Record<string, unknown> = {}) => ({
    clinic_id: clinic.clinicId,
    patient_id: mine.id,
    kind: "ALLERGY",
    label: "Penicillin",
    ...overrides,
  });

  beforeAll(async () => {
    mine = await create(receptionist, { full_name: "Alert Patient", assigned_doctor_id: doctorIds.A });
  });

  it("are written with visits.edit, and record who wrote them", async () => {
    const { data, error } = await alerts(assistant)
      .insert(alert({ note: "Rash, 2019" }))
      .select("*")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ kind: "ALLERGY", label: "Penicillin", active: true, created_by: assistant.userId });
    const { error: refused } = await alerts(receptionist).insert(alert({ label: "Aspirin" }));
    expect(refused?.code).toBe("42501");
  });

  it("are read with visits.view, within the doctor scope", async () => {
    expect((await alerts(assistant).select("label").eq("patient_id", mine.id)).data).toEqual([{ label: "Penicillin" }]);
    expect((await alerts(doctorA).select("label").eq("patient_id", mine.id)).data).toEqual([{ label: "Penicillin" }]);
    expect((await alerts(doctorC).select("label").eq("patient_id", mine.id)).data).toEqual([]);
    expect((await alerts(receptionist).select("label").eq("patient_id", mine.id)).data).toEqual([]);
    const { error } = await alerts(doctorC).insert(alert({ label: "Latex" }));
    expect(error?.code).toBe("42501");
  });

  it("are one per label and kind while active, whatever its case", async () => {
    const { error } = await alerts(doctorA).insert(alert({ label: "PENICILLIN" }));
    expect(error?.code).toBe("23505");
    const { data: other } = await alerts(doctorA)
      .insert(alert({ kind: "MEDICATION", label: "Penicillin" }))
      .select("id")
      .single();
    expect(other).not.toBeNull();
  });

  it("are turned off rather than deleted, and the label may then be added again", async () => {
    const { data: first } = await alerts(assistant)
      .select("id")
      .eq("patient_id", mine.id)
      .eq("kind", "ALLERGY")
      .single();
    const { error } = await alerts(assistant).update({ active: false }).eq("id", first!.id);
    expect(error).toBeNull();
    const { error: again } = await alerts(assistant).insert(alert());
    expect(again).toBeNull();
    const { data: removed } = await alerts(clinic.owner).delete().eq("id", first!.id).select("id");
    expect(removed ?? []).toEqual([]);
  });
});

describe("an import batch (plan §10.5, D51)", () => {
  const rows = (names: string[]) => names.map((full_name) => patient({ full_name, gender: "FEMALE" }));

  it("adds the rows as the owner, numbered in the order given", async () => {
    const { data, error } = await supabaseOf(clinic.owner).rpc("import_patients", {
      p_patients: rows(["Imported One", "Imported Two", "Imported Three"]),
    });
    expect(error).toBeNull();
    const added = data as PatientRow[];
    expect(added.map(({ full_name }) => full_name)).toEqual(["Imported One", "Imported Two", "Imported Three"]);
    const [first, second, third] = added.map(({ patient_number }) => patient_number);
    expect([second - first, third - second]).toEqual([1, 1]);
    expect(added.every(({ created_by }) => created_by === clinic.owner.userId)).toBe(true);
  });

  it("adds none of a batch with a row refused", async () => {
    const { error } = await supabaseOf(clinic.owner).rpc("import_patients", {
      p_patients: [
        ...rows(["Never Added"]),
        patient({ full_name: "Born Tomorrow", date_of_birth: addDaysKey(today, 1) }),
      ],
    });
    expect(error?.hint).toBe("PATIENT_BIRTH_DATE_INVALID");
    const { data } = await supabaseOf(clinic.owner).from("patients").select("id").eq("full_name", "Never Added");
    expect(data).toEqual([]);
  });

  it("is the owner's alone", async () => {
    const { error } = await supabaseOf(receptionist).rpc("import_patients", { p_patients: rows(["Not Mine"]) });
    expect(error?.hint).toBe("AUTH_PERMISSION_DENIED");
  });
});

describe("through the app's functions (R4.2)", () => {
  const typed = (overrides: Partial<PatientInput> = {}) =>
    patientSchema.parse({
      fullName: "Meena Iyer",
      phone: "99000 11223",
      born: { as: "AGE", years: "41" },
      gender: "FEMALE",
      ...overrides,
    });

  const auditOf = async (entityId: string) => {
    const { data } = await admin()
      .from("audit_logs")
      .select("action, actor_id, changes")
      .eq("entity_id", entityId)
      .order("created_at");
    return data!;
  };

  it("adds a patient once per key, audited once, by the names of their details alone", async () => {
    const key = randomUUID();
    const added = await createPatient(doctorA.tenant!, typed({ assignedDoctorId: doctorIds.B }), key, "req_add");
    expect(added).toMatchObject({
      name: "Meena Iyer",
      phone: "+919900011223",
      dobIsEstimated: true,
      gender: "FEMALE",
      assignedDoctorId: doctorIds.B,
      doctorName: "Test doctor",
      archived: false,
    });
    expect(await createPatient(doctorA.tenant!, typed(), key)).toMatchObject({ id: added.id, number: added.number });

    const audit = await auditOf(added.id);
    expect(audit).toEqual([
      {
        action: "CREATE",
        actor_id: doctorA.userId,
        changes: {
          patient_number: { from: null, to: added.number },
          assigned_doctor_id: { from: null, to: doctorIds.B },
          fields: ["full_name", "phone", "date_of_birth", "dob_is_estimated", "gender"],
        },
      },
    ]);
    expect(JSON.stringify(audit)).not.toMatch(/Meena|9900011223/);
  });

  it("reads and changes a patient within the doctor scope, audited by name", async () => {
    const theirs = await createPatient(receptionist.tenant!, typed({ assignedDoctorId: doctorIds.B }), randomUUID());
    expect(await getPatient(doctorB.tenant!, theirs.id)).toMatchObject({ id: theirs.id });
    await expect(getPatient(doctorC.tenant!, theirs.id)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    await expect(updatePatient(doctorC.tenant!, theirs.id, { fullName: "Changed" })).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });

    const changed = await updatePatient(receptionist.tenant!, theirs.id, { fullName: "Meena R Iyer", email: "m@x.in" });
    expect(changed).toMatchObject({ name: "Meena R Iyer", email: "m@x.in" });
    const [, update] = await auditOf(theirs.id);
    expect(update).toMatchObject({ action: "UPDATE", changes: { fields: ["full_name", "email"] } });
  });

  it("lists the patients on a mobile that the caller may see (D106)", async () => {
    const phone = "+919988776655";
    await createPatient(receptionist.tenant!, typed({ phone, fullName: "Elder Sister" }), randomUUID());
    await createPatient(
      receptionist.tenant!,
      typed({ phone, fullName: "Younger Brother", gender: "MALE", assignedDoctorId: doctorIds.C }),
      randomUUID(),
    );
    expect((await findPatientMatches(receptionist.tenant!, phone)).map(({ name }) => name)).toEqual([
      "Younger Brother",
      "Elder Sister",
    ]);
    expect((await findPatientMatches(doctorC.tenant!, phone)).map(({ name }) => name)).toEqual(["Younger Brother"]);
    expect(await findPatientMatches(other.owner.tenant, phone)).toEqual([]);
  });
});

describe("a view-only clinic (plan §7.3)", () => {
  it("adds and changes nothing", async () => {
    const mine = await create(other.owner, { full_name: "Before Expiry" });
    await setValidUntil(other.clinicId, addDaysKey(today, -PLATFORM_SETTING_DEFAULTS.graceDays - 30));
    expect((await refusal(other.owner, {}))?.hint).toBe("CLINIC_PLAN_EXPIRED");
    const { error } = await supabaseOf(other.owner).rpc("import_patients", { p_patients: [patient()] });
    expect(error?.hint).toBe("CLINIC_PLAN_EXPIRED");
    const { data } = await update(other.owner, mine.id, { full_name: "After Expiry" });
    expect(data).toBeNull();
    expect(await seen(other.owner, mine.id)).not.toBeNull();
  });
});
