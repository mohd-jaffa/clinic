import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { countFollowUps, listFollowUps } from "@/features/treatments/api";
import { recordFollowUpContact } from "@/features/treatments/records";
import type { FollowUp } from "@/features/treatments/types";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { followUpContactSchema } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The follow-ups screen's reads and its one write (plan §14.3; R7.4, D267,
 * D271, D273, D275), through the feature's functions, as each member: a tab a
 * page at a time and every tab's count; a call noted by the front desk —
 * how it went, a note, a day to be reminded on — read back as the last
 * contact with who made it, and audited with the note by name alone; a
 * reminder sent, noted as such; and what the database refuses.
 */
type Member = SignedIn & { memberId: string };

let clinic: TestClinic;
let desk: Member;
let nurse: Member;
let reader: Member;
let maya: Member;
let doctor = "";
const today = todayKey();
const DAY = 86_400_000;

const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];

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

async function aTreatment(patientId: string, nextDueOn: string) {
  const { data, error } = await clinic.owner.tenant.supabase.rpc("create_treatment", {
    p_treatment: {
      patient_id: patientId,
      doctor_id: doctor,
      name: "Root canal",
      status: "IN_PROGRESS",
      next_due_on: nextDueOn,
    },
    p_visit_id: null,
  });
  if (error) throw error;
  return (data as { treatment_id: string }).treatment_id;
}

/** A visit some days ago, done, with its follow-up day — as the visit screen leaves one. */
async function aPastVisit(patientId: string, daysAgo: number, followUpOn: string) {
  const at = new Date(Date.now() - daysAgo * DAY).toISOString();
  const { data, error } = await admin()
    .from("visits")
    .insert({
      clinic_id: clinic.clinicId,
      patient_id: patientId,
      doctor_id: doctor,
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

const all = async (who: Member, tab: "TODAY" | "OVERDUE") => {
  const rows: FollowUp[] = [];
  let cursor: number | undefined;
  do {
    const page = await listFollowUps(who.tenant!, { tab, cursor });
    rows.push(...page.items);
    cursor = page.nextCursor === null ? undefined : Number(page.nextCursor);
  } while (cursor !== undefined);
  return rows;
};
const findIn = async (who: Member, tab: "TODAY" | "OVERDUE", id: string) =>
  (await all(who, tab)).find((followUp) => followUp.id === id);
const contact = (fields: Record<string, unknown>) =>
  followUpContactSchema.parse({ outcome: "REACHED", note: "", snoozeUntil: "", ...fields });

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, nurse, reader, maya] = await Promise.all([
    addMember(clinic.clinicId, {
      permissions: ["patients.view", "appointments.view", "appointments.create", "appointments.edit"],
    }),
    addMember(clinic.clinicId, { permissions: CLINICAL }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
  ]);
  doctor = (await admin().from("doctors").select("id").eq("member_id", maya.memberId).single()).data!.id as string;
  await Promise.all([
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId),
    admin().from("profiles").update({ full_name: "Priya Shah" }).eq("id", desk.userId),
  ]);
});

afterAll(removeAll);

describe("a tab and its count (plan §14.3, D267)", () => {
  it("are read by the front desk as by a nurse, the follow-up whole, not yet contacted", async () => {
    const anita = await addPatient("Anita Rao");
    const sitting = await aTreatment(anita, today);
    for (const who of [desk, nurse]) {
      expect(await findIn(who, "TODAY", sitting)).toEqual({
        kind: "TREATMENT",
        id: sitting,
        patient: { id: anita, name: "Anita Rao", number: expect.any(Number), phone: "+919876543210" },
        title: "Root canal",
        doctorId: doctor,
        doctorName: "Maya Rao",
        dueOn: today,
        lastContact: null,
      });
    }
    const counts = await countFollowUps(desk.tenant!);
    expect(Object.keys(counts)).toEqual(
      expect.arrayContaining(["TODAY", "OVERDUE", "UPCOMING", "LAPSED", "COMPLETED"]),
    );
    expect(counts.TODAY).toBe((await all(desk, "TODAY")).length);
  });
});

describe("a contact noted (D271, D273, D275)", () => {
  it("reads back as the last contact, with who made it, audited with the note by name alone", async () => {
    const rohan = await addPatient("Rohan Mehta");
    const review = await aPastVisit(rohan, 10, addDaysKey(today, -4));
    const noted = await recordFollowUpContact(
      desk.tenant!,
      contact({ kind: "VISIT", id: review, outcome: "NO_ANSWER", note: "Line busy" }),
      "req_follow_up",
    );
    expect(noted).toEqual({ id: expect.any(String), patientId: rohan, outcome: "NO_ANSWER", snoozeUntil: null });
    expect((await findIn(nurse, "OVERDUE", review))!.lastContact).toEqual({
      outcome: "NO_ANSWER",
      at: expect.any(String),
      note: "Line busy",
      by: "Priya Shah",
    });
    const { data: audits } = await admin()
      .from("audit_logs")
      .select("action, entity_type, changes, request_id")
      .eq("entity_id", noted.id);
    expect(audits).toEqual([
      {
        action: "CREATE",
        entity_type: "follow_up_contacts",
        changes: { outcome: { from: null, to: "NO_ANSWER" }, snooze_until: { from: null, to: null }, fields: ["note"] },
        request_id: "req_follow_up",
      },
    ]);
    expect(JSON.stringify(audits)).not.toContain("Line busy");
  });

  it("takes a reminder sent, and one snoozed leaves its tab and its count until its day", async () => {
    const meena = await addPatient("Meena Gupta");
    const sitting = await aTreatment(meena, today);
    await recordFollowUpContact(nurse.tenant!, contact({ kind: "TREATMENT", id: sitting, outcome: "REMINDER_SENT" }));
    expect((await findIn(desk, "TODAY", sitting))!.lastContact).toMatchObject({
      outcome: "REMINDER_SENT",
      note: null,
    });
    const before = (await countFollowUps(desk.tenant!)).TODAY;
    const snoozed = await recordFollowUpContact(
      desk.tenant!,
      contact({ kind: "TREATMENT", id: sitting, outcome: "NO_ANSWER", snoozeUntil: addDaysKey(today, 3) }),
    );
    expect(snoozed.snoozeUntil).toBe(addDaysKey(today, 3));
    expect(await findIn(desk, "TODAY", sitting)).toBeUndefined();
    expect((await countFollowUps(desk.tenant!)).TODAY).toBe(before - 1);
  });

  it("is refused to one who only reads, for a day to be reminded on that is not after today, and for no such follow-up", async () => {
    const kiran = await addPatient("Kiran Shah");
    const sitting = await aTreatment(kiran, addDaysKey(today, 2));
    await expect(
      recordFollowUpContact(reader.tenant!, contact({ kind: "TREATMENT", id: sitting })),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    await expect(
      recordFollowUpContact(desk.tenant!, contact({ kind: "TREATMENT", id: sitting, snoozeUntil: today })),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(recordFollowUpContact(desk.tenant!, contact({ kind: "VISIT", id: sitting }))).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
  });
});
