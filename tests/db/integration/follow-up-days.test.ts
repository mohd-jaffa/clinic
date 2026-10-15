import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FOLLOW_UP_WINDOW_DAYS } from "@/constants/limits";
import type { Permission } from "@/constants/permissions";
import { PLATFORM_SETTING_BOUNDS } from "@/constants/platform";
import { FOLLOW_UP_TABS, type FollowUpTab } from "@/constants/statuses";
import { countFollowUps, listFollowUps } from "@/features/treatments/api";
import type { FollowUp } from "@/features/treatments/types";
import { addDaysKey, dayHour, dayTime, todayKey } from "@/lib/dates/calendar";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform/settings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import {
  addMember,
  admin,
  makeDeveloper,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Each follow-up on the right day (plan §14.3, §34; R7.5, D279 – D281). The
 * database's clock cannot be moved, so every edge a tab has is tested from
 * the clinic's today — Today against yesterday, the last day of Overdue
 * against the first of Lapsed, the 30th day ahead against the 31st, a
 * treatment completed 30 days ago against 31, a snooze's own day — and the
 * clinic's midnight where it can be fixed in time: a follow-up set at 1:30
 * AM in India, still the day before in UTC, is set on India's day. When an
 * overdue one lapses follows the DEV's setting, changed and put back.
 */
type Member = SignedIn & { memberId: string };

let clinic: TestClinic;
let nurse: Member;
let developer: SignedIn;
let doctor = "";
let consultation = "";
let lapsedBefore = 0;
const today = todayKey();
const LAPSED_MIN = PLATFORM_SETTING_BOUNDS.followUpLapsedDays.min;

const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];

const asDeveloper = () => createSupabaseAnonClient(developer.session.accessToken);
const lapseAfter = (days: number) =>
  updatePlatformSettings(asDeveloper(), { followUpLapsedDays: days }, "req_follow_up_days");

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

async function aTreatment(patientId: string, nextDueOn: string | null) {
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

/** A visit opened at `at`, done, with its follow-up day — as the visit screen leaves one. */
async function aVisit(patientId: string, at: string, followUpOn: string) {
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

/** A visit some days ago, at 10 AM in the clinic. */
const aPastVisit = (patientId: string, daysAgo: number, followUpOn: string) =>
  aVisit(patientId, dayHour(addDaysKey(today, -daysAgo), 10), followUpOn);

/** An appointment kept at `at`, as the queue leaves one. */
async function aKeptAppointment(patientId: string, at: string) {
  const { error } = await admin().from("appointments").insert({
    clinic_id: clinic.clinicId,
    patient_id: patientId,
    doctor_id: doctor,
    source: "BOOKED",
    appointment_type_id: consultation,
    scheduled_at: at,
    duration_minutes: 15,
    status: "COMPLETED",
  });
  if (error) throw error;
}

/** A contact, as the desk left one, keeping the follow-up off the lists until `snoozeUntil`. */
async function aSnooze(patientId: string, visitId: string, snoozeUntil: string) {
  const { error } = await admin().from("follow_up_contacts").insert({
    clinic_id: clinic.clinicId,
    patient_id: patientId,
    visit_id: visitId,
    outcome: "NO_ANSWER",
    snooze_until: snoozeUntil,
  });
  if (error) throw error;
}

/** Every tab as the nurse reads it, every page, and how many each says it holds. */
async function tabs() {
  const lists = {} as Record<FollowUpTab, FollowUp[]>;
  for (const tab of FOLLOW_UP_TABS) {
    lists[tab] = [];
    let cursor: number | undefined;
    do {
      const page = await listFollowUps(nurse.tenant!, { tab, cursor });
      lists[tab].push(...page.items);
      cursor = page.nextCursor === null ? undefined : Number(page.nextCursor);
    } while (cursor !== undefined);
  }
  return { lists, counts: await countFollowUps(nurse.tenant!) };
}

/** The tab a follow-up is in, or null for none. */
async function tabOf(id: string): Promise<FollowUpTab | null> {
  const { lists } = await tabs();
  return FOLLOW_UP_TABS.find((tab) => lists[tab].some((followUp) => followUp.id === id)) ?? null;
}

beforeAll(async () => {
  lapsedBefore = (await getPlatformSettings()).followUpLapsedDays;
  developer = await makeDeveloper();
  clinic = await registerClinic({ fullName: "Asha Menon" });
  const maya = await addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL });
  nurse = await addMember(clinic.clinicId, { permissions: CLINICAL });
  doctor = (await admin().from("doctors").select("id").eq("member_id", maya.memberId).single()).data!.id as string;
  consultation = (
    await admin()
      .from("appointment_types")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .single()
  ).data!.id as string;
});

afterAll(async () => {
  await lapseAfter(lapsedBefore);
  await removeAll();
});

describe("the tabs' edges, from the clinic's today (plan §14.3; D279)", () => {
  it("puts today's in Today, yesterday's in Overdue, and tomorrow's in Upcoming", async () => {
    const [anita, vikram, rohan, kiran] = await Promise.all(
      ["Anita Rao", "Vikram Singh", "Rohan Mehta", "Kiran Shah"].map(addPatient),
    );
    const sitting = await aTreatment(anita, today);
    const review = await aPastVisit(vikram, 7, today);
    const missed = await aPastVisit(rohan, 7, addDaysKey(today, -1));
    const next = await aTreatment(kiran, addDaysKey(today, 1));
    expect(await tabOf(sitting)).toBe("TODAY");
    expect(await tabOf(review)).toBe("TODAY");
    expect(await tabOf(missed)).toBe("OVERDUE");
    expect(await tabOf(next)).toBe("UPCOMING");
  });

  it("keeps one in Overdue to its lapsed day, and in Lapsed from the day after", async () => {
    const lapsed = (await getPlatformSettings()).followUpLapsedDays;
    const [meena, leela] = await Promise.all(["Meena Gupta", "Leela Nair"].map(addPatient));
    const last = await aPastVisit(meena, lapsed + 10, addDaysKey(today, -lapsed));
    const first = await aPastVisit(leela, lapsed + 10, addDaysKey(today, -lapsed - 1));
    expect(await tabOf(last)).toBe("OVERDUE");
    expect(await tabOf(first)).toBe("LAPSED");
  });

  it("looks 30 days ahead, and no further (D270)", async () => {
    const [sneha, farah] = await Promise.all(["Sneha Pillai", "Farah Khan"].map(addPatient));
    const inside = await aTreatment(sneha, addDaysKey(today, FOLLOW_UP_WINDOW_DAYS));
    const outside = await aTreatment(farah, addDaysKey(today, FOLLOW_UP_WINDOW_DAYS + 1));
    expect(await tabOf(inside)).toBe("UPCOMING");
    expect(await tabOf(outside)).toBeNull();
  });

  it("holds a treatment completed 30 days ago in Completed, and not one completed 31 days ago", async () => {
    const [divya, nisha] = await Promise.all(["Divya Nair", "Nisha Verma"].map(addPatient));
    const completedDaysAgo = async (patientId: string, days: number) => {
      const id = await aTreatment(patientId, null);
      const { error } = await clinic.owner.tenant.supabase.rpc("change_treatment_status", {
        p_treatment_id: id,
        p_status: "COMPLETED",
        p_seen: "IN_PROGRESS",
      });
      if (error) throw error;
      // Completed that long ago, as it stood then.
      const { error: moved } = await admin()
        .from("treatments")
        .update({ started_on: addDaysKey(today, -days - 10), completed_on: addDaysKey(today, -days) })
        .eq("id", id);
      if (moved) throw moved;
      return id;
    };
    expect(await tabOf(await completedDaysAgo(divya, FOLLOW_UP_WINDOW_DAYS))).toBe("COMPLETED");
    expect(await tabOf(await completedDaysAgo(nisha, FOLLOW_UP_WINDOW_DAYS + 1))).toBeNull();
  });

  it("brings one snoozed back on its own day, and not before (D271)", async () => {
    const [pooja, ritu] = await Promise.all(["Pooja Menon", "Ritu Das"].map(addPatient));
    const back = await aPastVisit(pooja, 7, addDaysKey(today, -2));
    const away = await aPastVisit(ritu, 7, addDaysKey(today, -2));
    await aSnooze(pooja, back, today);
    await aSnooze(ritu, away, addDaysKey(today, 1));
    expect(await tabOf(back)).toBe("OVERDUE");
    expect(await tabOf(away)).toBeNull();
  });
});

describe("the clinic's midnight (D268, D279)", () => {
  it("takes the day a follow-up was set at 1:30 AM as the clinic's day, not UTC's", async () => {
    const set = addDaysKey(today, -5);
    // 1:30 AM in India is 8 PM the day before in UTC.
    const at = dayTime(set, "01:30");
    expect(at.slice(0, 10)).toBe(addDaysKey(set, -1));
    const [arun, bina] = await Promise.all(["Arun Kumar", "Bina Shah"].map(addPatient));
    const review = await aVisit(arun, at, addDaysKey(today, 3));
    const sitting = await aTreatment(bina, addDaysKey(today, 3));
    // Its next sitting set at that hour, as it stood then.
    const { error } = await admin().from("treatments").update({ next_due_set_at: at }).eq("id", sitting);
    if (error) throw error;

    // Kept the same day in India — a later day in UTC — it is not yet done.
    await aKeptAppointment(arun, dayHour(set, 10));
    await aKeptAppointment(bina, dayHour(set, 11));
    expect(await tabOf(review)).toBe("UPCOMING");
    expect(await tabOf(sitting)).toBe("UPCOMING");

    // Kept the next day in India, it is.
    await aKeptAppointment(arun, dayHour(addDaysKey(set, 1), 10));
    await aKeptAppointment(bina, dayHour(addDaysKey(set, 1), 11));
    expect(await tabOf(review)).toBeNull();
    expect(await tabOf(sitting)).toBeNull();
  });
});

describe("when an overdue follow-up lapses (§6; D280)", () => {
  it("follows the DEV's setting at once, the counts with the lists", async () => {
    const [omar, priya, gita] = await Promise.all(["Omar Ali", "Priya Iyer", "Gita Rao"].map(addPatient));
    const tenDays = await aPastVisit(omar, 20, addDaysKey(today, -10));
    const edge = await aPastVisit(priya, 20, addDaysKey(today, -LAPSED_MIN));
    const fortyDays = await aPastVisit(gita, 50, addDaysKey(today, -40));
    const countsAgree = async () => {
      const { lists, counts } = await tabs();
      for (const tab of FOLLOW_UP_TABS) expect(counts[tab], tab).toBe(lists[tab].length);
    };

    await lapseAfter(LAPSED_MIN);
    expect(await tabOf(tenDays)).toBe("LAPSED");
    expect(await tabOf(edge)).toBe("OVERDUE");
    expect(await tabOf(fortyDays)).toBe("LAPSED");
    await countsAgree();

    await lapseAfter(60);
    expect(await tabOf(tenDays)).toBe("OVERDUE");
    expect(await tabOf(fortyDays)).toBe("OVERDUE");
    await countsAgree();

    await lapseAfter(lapsedBefore);
    expect(await tabOf(fortyDays)).toBe(lapsedBefore >= 40 ? "OVERDUE" : "LAPSED");
  });
});
