import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { sendIn } from "@/features/appointments/moves";
import { archivePatient } from "@/features/patients/api";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
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
 * Follow-ups in the database (plan §14.2, §14.3; R7.3, D267 – D271): a
 * treatment's next sitting — on hold too — or a visit's follow-up, in its tab
 * by the clinic's today and the lapsed days; done by an appointment for a
 * later day, to come or kept, or a later visit; out of the lists and counts
 * while snoozed. Worked by whoever sees appointments or visits, within the
 * doctor scope; a call noted by appointments.edit or visits.edit.
 */
type Member = SignedIn & { memberId: string };

let clinic: TestClinic;
let desk: Member;
let caller: Member;
let nurse: Member;
let outsider: Member;
let maya: Member;
let ravi: Member;
const doctors = { maya: "", ravi: "" };
let consultation: string;
const today = todayKey();
const DAY = 86_400_000;

const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];

interface Item {
  kind: string;
  treatment_id: string | null;
  visit_id: string | null;
  patient_id: string;
  patient_name: string;
  title: string | null;
  doctor_name: string | null;
  due_on: string;
  last_outcome: string | null;
  last_note: string | null;
}

const doctorIdOf = async (memberId: string) =>
  (await admin().from("doctors").select("id").eq("member_id", memberId).single()).data!.id as string;

async function addPatient(name: string) {
  const { data, error } = await clinic.owner.tenant.supabase
    .rpc("create_patient", {
      p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  return data.patient_id;
}

/** A treatment for Dr. Maya Rao, as the owner starts it from the profile. */
async function aTreatment(patientId: string, treatment: Record<string, unknown>) {
  const { data, error } = await clinic.owner.tenant.supabase.rpc("create_treatment", {
    p_treatment: {
      patient_id: patientId,
      doctor_id: doctors.maya,
      name: "Root canal",
      status: "IN_PROGRESS",
      ...treatment,
    },
    p_visit_id: null,
  });
  if (error) throw error;
  return (data as { treatment_id: string }).treatment_id;
}

/** A visit some days ago, done, with its follow-up day — as the visit screen leaves one. */
async function aPastVisit(patientId: string, daysAgo: number, followUpOn: string, doctorId = doctors.maya) {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  const { data, error } = await admin()
    .from("visits")
    .insert({
      clinic_id: clinic.clinicId,
      patient_id: patientId,
      doctor_id: doctorId,
      started_at: at,
      created_at: at,
      status: "COMPLETED",
      completed_at: at,
      billing_status: "TO_BILL",
      follow_up_on: followUpOn,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** A visit now: walked in and sent in. */
async function aVisitNow(patientId: string, doctorId: string) {
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: consultation }),
    randomUUID(),
  );
  return sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
}

async function book(patientId: string, day: string, doctorId = doctors.ravi) {
  const { data, error } = await desk
    .tenant!.supabase.rpc("create_appointment", {
      p_appointment: {
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_type_id: consultation,
        scheduled_at: dayHour(day, 10),
        duration_minutes: 15,
      },
      p_idempotency_key: randomUUID(),
    })
    .single<{ appointment_id: string }>();
  if (error) throw error;
  return data.appointment_id;
}

const listOf = async (who: Member, tab: string) => {
  const { data, error } = await who.tenant!.supabase.rpc("follow_up_items", { p_tab: tab, p_offset: 0, p_limit: 100 });
  if (error) throw error;
  return data as Item[];
};
const itemsFor = async (who: Member, tab: string, patientId: string) =>
  (await listOf(who, tab)).filter((item) => item.patient_id === patientId);
const countsOf = async (who: Member) => {
  const { data, error } = await who.tenant!.supabase.rpc("follow_up_counts");
  if (error) throw error;
  return Object.fromEntries((data as { tab: string; total: number }[]).map(({ tab, total }) => [tab, Number(total)]));
};
const note = (who: Member, contact: Record<string, unknown>) =>
  who.tenant!.supabase.rpc("record_follow_up_contact", { p_contact: { outcome: "REACHED", ...contact } });

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, caller, nurse, outsider, maya, ravi] = await Promise.all([
    addMember(clinic.clinicId, {
      permissions: [
        "patients.view",
        "patients.create",
        "patients.edit",
        "appointments.view",
        "appointments.create",
        "appointments.edit",
        "appointments.cancel",
      ],
    }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view"] }),
    addMember(clinic.clinicId, { permissions: CLINICAL }),
    addMember(clinic.clinicId, { permissions: ["patients.view"] }),
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

describe("the tabs (plan §14.3; D269, D270)", () => {
  it("put each follow-up by the clinic's today: today, overdue, upcoming, lapsed — and completed treatments", async () => {
    const [anita, kiran, meera, leela, farah] = await Promise.all(
      ["Anita Rao", "Kiran Shah", "Meera Iyer", "Leela Nair", "Farah Khan"].map(addPatient),
    );
    const sitting = await aTreatment(anita, { name: "Root canal", next_due_on: today });
    await aTreatment(kiran, { name: "Crown", status: "PLANNED", next_due_on: addDaysKey(today, 7) });
    await aTreatment(kiran, { name: "Braces", next_due_on: addDaysKey(today, 31) });
    const review = await aPastVisit(meera, 10, addDaysKey(today, -5));
    await aPastVisit(leela, 60, addDaysKey(today, -40));
    const done = await aTreatment(farah, { name: "Scaling" });
    await clinic.owner.tenant.supabase.rpc("change_treatment_status", {
      p_treatment_id: done,
      p_status: "COMPLETED",
      p_seen: "IN_PROGRESS",
    });

    expect(await itemsFor(nurse, "TODAY", anita)).toEqual([
      expect.objectContaining({
        kind: "TREATMENT",
        treatment_id: sitting,
        visit_id: null,
        patient_name: "Anita Rao",
        title: "Root canal",
        doctor_name: "Maya Rao",
        due_on: today,
        last_outcome: null,
      }),
    ]);
    // The next 30 days only (D270).
    expect((await itemsFor(nurse, "UPCOMING", kiran)).map(({ title }) => title)).toEqual(["Crown"]);
    expect(await itemsFor(nurse, "OVERDUE", meera)).toEqual([
      expect.objectContaining({ kind: "VISIT", visit_id: review, title: null, due_on: addDaysKey(today, -5) }),
    ]);
    // Overdue by more than follow_up_lapsed_days (30 by default).
    expect((await itemsFor(nurse, "LAPSED", leela)).map(({ due_on }) => due_on)).toEqual([addDaysKey(today, -40)]);
    expect(await itemsFor(nurse, "COMPLETED", farah)).toEqual([
      expect.objectContaining({ title: "Scaling", due_on: today }),
    ]);
    for (const tab of ["TODAY", "OVERDUE", "UPCOMING", "LAPSED", "COMPLETED"]) {
      expect((await countsOf(nurse))[tab], tab).toBe((await listOf(nurse, tab)).length);
    }
  });

  it("lists an on-hold treatment with a next sitting (D269), and none of an archived patient's", async () => {
    const [held, gone] = [await addPatient("Nisha Verma"), await addPatient("Pooja Menon")];
    const braces = await aTreatment(held, { name: "Braces", next_due_on: addDaysKey(today, 3) });
    await clinic.owner.tenant.supabase.rpc("change_treatment_status", {
      p_treatment_id: braces,
      p_status: "ON_HOLD",
      p_seen: "IN_PROGRESS",
    });
    expect((await itemsFor(nurse, "UPCOMING", held)).map(({ title }) => title)).toEqual(["Braces"]);
    await aPastVisit(gone, 10, addDaysKey(today, -3));
    expect(await itemsFor(nurse, "OVERDUE", gone)).toHaveLength(1);
    await archivePatient(desk.tenant!, gone);
    expect(await itemsFor(nurse, "OVERDUE", gone)).toEqual([]);
  });
});

describe("what closes a follow-up (plan §14.2; D268)", () => {
  it("an appointment for a later day with any doctor, to come — until it is cancelled — but not one left unmarked", async () => {
    const patient = await addPatient("Arjun Das");
    await aPastVisit(patient, 10, addDaysKey(today, -2));
    // Booked before its due day, with another doctor: they are coming in.
    const booked = await book(patient, addDaysKey(today, 1));
    expect(await itemsFor(nurse, "OVERDUE", patient)).toEqual([]);
    await desk.tenant!.supabase.rpc("change_appointment_status", {
      p_appointment_id: booked,
      p_status: "CANCELLED",
      p_reason: "Patient asked",
    });
    expect(await itemsFor(nurse, "OVERDUE", patient)).toHaveLength(1);
    // One booked for a day gone by and never marked closes nothing.
    const { error } = await admin()
      .from("appointments")
      .insert({
        clinic_id: clinic.clinicId,
        patient_id: patient,
        doctor_id: doctors.maya,
        source: "BOOKED",
        appointment_type_id: consultation,
        scheduled_at: dayHour(addDaysKey(today, -1), 10),
        duration_minutes: 15,
      });
    expect(error).toBeNull();
    expect(await itemsFor(nurse, "OVERDUE", patient)).toHaveLength(1);
  });

  it("a visit opened after it was set — not the visit that set it — and a treatment closing or losing its day", async () => {
    const [seen, treated, set] = [
      await addPatient("Kabir Sethi"),
      await addPatient("Ritu Bose"),
      await addPatient("Vikram Joshi"),
    ];
    await aTreatment(seen, { next_due_on: addDaysKey(today, 3) });
    await aVisitNow(seen, doctors.ravi);
    expect(await itemsFor(nurse, "UPCOMING", seen)).toEqual([]);

    const crown = await aTreatment(treated, { name: "Crown", next_due_on: addDaysKey(today, 3) });
    const { data: due } = await admin().from("treatments").select("next_due_set_at").eq("id", crown).single();
    expect(due!.next_due_set_at).not.toBeNull();
    await clinic.owner.tenant.supabase.rpc("update_treatment", {
      p_treatment_id: crown,
      p_changes: { next_due_on: null },
      p_seen: { next_due_on: addDaysKey(today, 3) },
    });
    const { data: cleared } = await admin().from("treatments").select("next_due_set_at").eq("id", crown).single();
    expect(cleared).toEqual({ next_due_set_at: null });
    expect(await itemsFor(nurse, "UPCOMING", treated)).toEqual([]);

    // Set during a visit, it waits for the next one.
    const { visitId } = await aVisitNow(set, doctors.maya);
    const { error } = await maya.tenant!.supabase.rpc("create_treatment", {
      p_treatment: { name: "Implant", status: "IN_PROGRESS", next_due_on: addDaysKey(today, 7) },
      p_visit_id: visitId,
    });
    expect(error).toBeNull();
    expect((await itemsFor(nurse, "UPCOMING", set)).map(({ title }) => title)).toEqual(["Implant"]);
  });
});

describe("a contact (D267, D271)", () => {
  it("is noted with its outcome; one with a later reminder day leaves the lists and the counts until then", async () => {
    const patient = await addPatient("Sunita Rao");
    const visitId = await aPastVisit(patient, 5, addDaysKey(today, -1));
    const before = (await countsOf(desk)).OVERDUE;

    const { data, error } = await note(desk, { visit_id: visitId, outcome: "NO_ANSWER", note: "Rang twice" });
    expect(error).toBeNull();
    expect(data).toMatchObject({ patient_id: patient, outcome: "NO_ANSWER", snooze_until: null });
    expect(await itemsFor(desk, "OVERDUE", patient)).toEqual([
      expect.objectContaining({ last_outcome: "NO_ANSWER", last_note: "Rang twice" }),
    ]);

    await note(desk, { visit_id: visitId, outcome: "REACHED", snooze_until: addDaysKey(today, 2) });
    expect(await itemsFor(desk, "OVERDUE", patient)).toEqual([]);
    expect((await countsOf(desk)).OVERDUE).toBe(before - 1);
    // On its day it is back, with its last contact.
    await admin().from("follow_up_contacts").insert({
      clinic_id: clinic.clinicId,
      patient_id: patient,
      visit_id: visitId,
      outcome: "DECLINED",
      snooze_until: today,
    });
    expect(await itemsFor(desk, "OVERDUE", patient)).toEqual([expect.objectContaining({ last_outcome: "DECLINED" })]);
  });

  it("is refused for a reminder day not after today, none or both follow-ups, one not found, and an archived patient", async () => {
    const patient = await addPatient("Leena Paul");
    const visitId = await aPastVisit(patient, 5, addDaysKey(today, -1));
    const treatment = await aTreatment(await addPatient("Joy Thomas"), { next_due_on: today });
    expect((await note(desk, { visit_id: visitId, snooze_until: today })).error?.hint).toBe("VALIDATION_ERROR");
    expect((await note(desk, {})).error?.hint).toBe("VALIDATION_ERROR");
    expect((await note(desk, { visit_id: visitId, treatment_id: treatment })).error?.hint).toBe("VALIDATION_ERROR");
    expect((await note(desk, { treatment_id: randomUUID() })).error?.hint).toBe("RECORD_NOT_FOUND");
    expect((await note(desk, { visit_id: visitId, outcome: "LOST" })).error?.code).toBe("23514");
    await archivePatient(desk.tenant!, patient);
    expect((await note(desk, { visit_id: visitId })).error?.hint).toBe("PATIENT_ARCHIVED");
  });
});

describe("who works them (D267)", () => {
  it("is whoever sees appointments or visits — a doctor only their own patients'; no one else", async () => {
    const [hers, his] = [await addPatient("Maya's patient"), await addPatient("Ravi's patient")];
    await aPastVisit(hers, 5, addDaysKey(today, -1), doctors.maya);
    await aPastVisit(his, 5, addDaysKey(today, -1), doctors.ravi);
    for (const who of [desk, caller, nurse]) {
      expect(await itemsFor(who, "OVERDUE", hers)).toHaveLength(1);
    }
    expect(await itemsFor(maya, "OVERDUE", hers)).toHaveLength(1);
    expect(await itemsFor(maya, "OVERDUE", his)).toEqual([]);
    for (const [name, args] of [
      ["follow_up_items", { p_tab: "TODAY", p_offset: 0, p_limit: 20 }],
      ["follow_up_counts", {}],
    ] as const) {
      const { error } = await outsider.tenant!.supabase.rpc(name, args);
      expect(error?.hint, name).toBe("AUTH_PERMISSION_DENIED");
    }
    expect(
      (await caller.tenant!.supabase.rpc("follow_up_items", { p_tab: "SOON", p_offset: 0, p_limit: 20 })).error?.hint,
    ).toBe("VALIDATION_ERROR");
  });

  it("notes a call with appointments.edit or visits.edit, and reads them with appointments or visits seen", async () => {
    const patient = await addPatient("Call Matrix");
    const visitId = await aPastVisit(patient, 5, addDaysKey(today, -1));
    expect((await note(caller, { visit_id: visitId })).error?.hint).toBe("AUTH_PERMISSION_DENIED");
    expect((await note(outsider, { visit_id: visitId })).error?.hint).toBe("AUTH_PERMISSION_DENIED");
    expect((await note(nurse, { visit_id: visitId, outcome: "BOOKED" })).error).toBeNull();
    expect((await note(desk, { visit_id: visitId, outcome: "REMINDER_SENT" })).error).toBeNull();
    // Ravi has never seen this patient.
    expect((await note(ravi, { visit_id: visitId })).error?.hint).toBe("RECORD_NOT_FOUND");

    const { data: read } = await caller
      .tenant!.supabase.from("follow_up_contacts")
      .select("outcome")
      .eq("visit_id", visitId);
    expect(read).toHaveLength(2);
    const { data: unread } = await outsider
      .tenant!.supabase.from("follow_up_contacts")
      .select("id")
      .eq("visit_id", visitId);
    expect(unread).toEqual([]);
    const { error } = await desk
      .tenant!.supabase.from("follow_up_contacts")
      .insert({ clinic_id: clinic.clinicId, patient_id: patient, visit_id: visitId, outcome: "REACHED" });
    expect(error?.code).toBe("42501");
  });
});
