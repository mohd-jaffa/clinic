import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PlatformSettings } from "@/constants/platform";
import type { SubscriptionPlan } from "@/constants/statuses";
import { sendSubscriptionNotices, type ClaimedNotice } from "@/features/subscription/notices";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth } from "@/lib/format/date";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform/settings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import {
  admin,
  makeDeveloper,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";
import { latestMessageTo, messagesTo } from "@tests/support/mailpit";

/**
 * The daily plan emails (plan §22; R11.5, D382 – D386), against the local
 * Supabase and Mailpit: each owner is told what is due for their plan's last
 * day, once — before it ends, the day after, the day it becomes view-only —
 * a missed day caught up with the latest alone, a new last day starting
 * again, a clinic waiting for activation told nothing; an email that did not
 * go is tried again; two runs at once tell no one twice. The run may also
 * tell other local clinics, so only these clinics are looked at.
 */
let developer: SignedIn;
let saved: PlatformSettings;
const clinics: Record<string, TestClinic> = {};
const today = todayKey();
const asDeveloper = () => createSupabaseAnonClient(developer.session.accessToken);

/** Sets a plan, and its last day, as an extension would have. */
async function setPlan(clinic: TestClinic, plan: SubscriptionPlan, validUntil: string) {
  const { error } = await admin()
    .from("clinic_subscriptions")
    .update({ plan, valid_until: validUntil })
    .eq("clinic_id", clinic.clinicId);
  if (error) throw error;
}

/** What a plan was last told. */
async function told(clinic: TestClinic) {
  const { data } = await admin()
    .from("clinic_subscriptions")
    .select("last_notice, last_notice_due, last_notice_for")
    .eq("clinic_id", clinic.clinicId)
    .single();
  return data;
}

const inbox = async (clinic: TestClinic) => (await messagesTo(clinic.owner.email)).length;

/** The owner's newest email, once more than `seen` have come — sign-up sent one first. */
async function nextMail(clinic: TestClinic, seen: number) {
  for (let attempt = 0; attempt < 20 && (await inbox(clinic)) <= seen; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return latestMessageTo(clinic.owner.email);
}

const run = () => sendSubscriptionNotices(admin(), `req_${randomUUID()}`);
const claimAll = async () =>
  (await admin().rpc("claim_subscription_notices", { p_limit: 1000 })).data as ClaimedNotice[];
const releaseAll = (claims: ClaimedNotice[]) => admin().rpc("release_subscription_notices", { p_claims: claims });

beforeAll(async () => {
  [saved, developer] = await Promise.all([getPlatformSettings(), makeDeveloper()]);
  await updatePlatformSettings(asDeveloper(), { expiryNoticeDays: [7, 1], graceDays: 7 }, "req_notices_setup");
  const names = ["soon", "late", "ended", "viewOnly", "fine", "waiting", "graceless", "failing", "racing"];
  const made = await Promise.all(names.map((name) => registerClinic({ clinicName: `Notice ${name}` })));
  names.forEach((name, at) => (clinics[name] = made[at]));
  await Promise.all([
    setPlan(clinics.soon, "TRIAL", addDaysKey(today, 7)),
    setPlan(clinics.late, "MONTHLY", addDaysKey(today, 3)),
    setPlan(clinics.ended, "MONTHLY", addDaysKey(today, -1)),
    setPlan(clinics.viewOnly, "YEARLY", addDaysKey(today, -8)),
    setPlan(clinics.fine, "MONTHLY", addDaysKey(today, 30)),
    // Waiting for activation: still on the trial, its last day before it signed up (plan §7.6).
    setPlan(clinics.waiting, "TRIAL", addDaysKey(today, -61)),
    setPlan(clinics.graceless, "MONTHLY", addDaysKey(today, 40)),
    setPlan(clinics.failing, "MONTHLY", addDaysKey(today, 40)),
    setPlan(clinics.racing, "MONTHLY", addDaysKey(today, 40)),
  ]);
});

afterAll(async () => {
  await updatePlatformSettings(asDeveloper(), saved, "req_restore");
  await removeAll();
});

describe("the daily plan emails (plan §22)", () => {
  it("tells each owner what is due, once: ending soon, a missed day caught up, ended, view-only", async () => {
    const seen = Object.fromEntries(
      await Promise.all(Object.entries(clinics).map(async ([name, clinic]) => [name, await inbox(clinic)])),
    );
    const first = await run();
    expect(first.failed).toBe(0);

    const soon = await nextMail(clinics.soon, seen.soon);
    expect(soon.subject).toBe(`Notice soon's free trial ends on ${formatDayMonth(addDaysKey(today, 7))}`);
    expect(soon.html).toContain("Your free trial ends in 7 days");
    expect(await told(clinics.soon)).toEqual({
      last_notice: "ENDS_SOON",
      last_notice_due: today,
      last_notice_for: addDaysKey(today, 7),
    });

    // Its 7-day email was missed: the run catches up with it, counting the days left now.
    const late = await nextMail(clinics.late, seen.late);
    expect(late.html).toContain("Your plan ends in 3 days");
    expect(await told(clinics.late)).toMatchObject({
      last_notice: "ENDS_SOON",
      last_notice_due: addDaysKey(today, -4),
    });

    const ended = await nextMail(clinics.ended, seen.ended);
    expect(ended.subject).toBe("Notice ended's plan has ended");
    expect(ended.text).toContain(`becomes view-only`);

    const viewOnly = await nextMail(clinics.viewOnly, seen.viewOnly);
    expect(viewOnly.subject).toBe("Notice viewOnly is now view-only");
    expect(await told(clinics.viewOnly)).toMatchObject({ last_notice: "READ_ONLY", last_notice_due: today });

    // Nothing due yet, and a clinic waiting for activation (D385): told nothing.
    for (const name of ["fine", "waiting"]) {
      expect(await inbox(clinics[name]), name).toBe(seen[name]);
      expect(await told(clinics[name]), name).toEqual({
        last_notice: null,
        last_notice_due: null,
        last_notice_for: null,
      });
    }

    // Run again: nobody is told twice.
    await run();
    for (const name of ["soon", "late", "ended", "viewOnly"]) {
      expect(await inbox(clinics[name]), name).toBe(seen[name] + 1);
    }
  });

  it("starts again for a new last day, and sends the next notice for the same one", async () => {
    const seen = await inbox(clinics.soon);
    await setPlan(clinics.soon, "TRIAL", addDaysKey(today, 1));
    await run();
    expect((await nextMail(clinics.soon, seen)).html).toContain("Your free trial ends tomorrow");

    // Told only an earlier notice for this same last day: the one due now follows.
    const before = await inbox(clinics.ended);
    const { error } = await admin()
      .from("clinic_subscriptions")
      .update({ last_notice: "ENDS_SOON", last_notice_due: addDaysKey(today, -2) })
      .eq("clinic_id", clinics.ended.clinicId);
    expect(error).toBeNull();
    await run();
    expect((await nextMail(clinics.ended, before)).subject).toBe("Notice ended's plan has ended");
  });

  it("goes straight to view-only when there is no grace", async () => {
    await updatePlatformSettings(asDeveloper(), { graceDays: 0 }, "req_notices_no_grace");
    try {
      await setPlan(clinics.graceless, "MONTHLY", addDaysKey(today, -1));
      await run();
      expect(await told(clinics.graceless)).toMatchObject({ last_notice: "READ_ONLY", last_notice_due: today });
    } finally {
      await updatePlatformSettings(asDeveloper(), { graceDays: 7 }, "req_notices_grace_back");
    }
  });

  it("puts back an email that did not go, for the next run to try again (D383)", async () => {
    await setPlan(clinics.failing, "MONTHLY", addDaysKey(today, -1));
    const claims = await claimAll();
    const ours = claims.find((claim) => claim.clinic_id === clinics.failing.clinicId);
    expect(ours).toMatchObject({
      notice: "ENDED",
      due: today,
      previous_due: null,
      owner_email: clinics.failing.owner.email,
    });
    expect((await told(clinics.failing))?.last_notice).toBe("ENDED");

    const { error } = await releaseAll(claims);
    expect(error).toBeNull();
    expect(await told(clinics.failing)).toEqual({ last_notice: null, last_notice_due: null, last_notice_for: null });
    const again = await claimAll();
    expect(again.some((claim) => claim.clinic_id === clinics.failing.clinicId)).toBe(true);
    await releaseAll(again);
  });

  it("tells no one twice when two runs claim at once", async () => {
    await setPlan(clinics.racing, "MONTHLY", addDaysKey(today, -1));
    const [one, two] = await Promise.all([claimAll(), claimAll()]);
    const racing = [...one, ...two].filter((claim) => claim.clinic_id === clinics.racing.clinicId);
    expect(racing).toHaveLength(1);
    await releaseAll([...one, ...two]);
  });

  it("is claimed by no one signed in", async () => {
    const { error } = await asDeveloper().rpc("claim_subscription_notices", { p_limit: 1 });
    expect(error?.code).toBe("42501");
    const { error: owner } = await clinics.fine.owner.tenant.supabase.rpc("release_subscription_notices", {
      p_claims: [],
    });
    expect(owner?.code).toBe("42501");
  });
});
