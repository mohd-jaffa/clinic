import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getConsoleClinic,
  getConsoleOverview,
  listConsoleAccounts,
  listConsoleAudit,
  listConsoleClinics,
  listConsoleErrors,
} from "@/features/admin/api";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform/settings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { PlatformSettings } from "@/constants/platform";
import {
  admin,
  makeDeveloper,
  registerClinic,
  removeAll,
  setValidUntil,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The developer console's reads (plan §20; R11.2, D367 – D372), against the
 * local Supabase: the Overview counts each clinic once and No trial right;
 * the Clinics list finds, filters and pages; a clinic's page and Accounts
 * show who and where; the error log and the platform audit read whole —
 * and none of it hands back a clinic's data, nor answers anyone signed in.
 */
let developer: SignedIn;
let saved: PlatformSettings;
const tag = randomUUID().slice(0, 8);
const asDeveloper = () => createSupabaseAnonClient(developer.session.accessToken);

let trial: TestClinic;
let waiting: TestClinic;
let paid: TestClinic;
let before: Awaited<ReturnType<typeof getConsoleOverview>>;

beforeAll(async () => {
  saved = await getPlatformSettings();
  developer = await makeDeveloper();
  before = await getConsoleOverview(admin());
  [trial, waiting, paid] = await Promise.all([
    registerClinic({ clinicName: `Trial ${tag}` }),
    registerClinic({ clinicName: `Waiting ${tag}` }),
    registerClinic({ clinicName: `Paid ${tag}` }),
  ]);
  // Waiting: a mobile that had its trial before is given a last day before it signed up (0008).
  await setValidUntil(waiting.clinicId, addDaysKey(todayKey(), -61));
  const { error } = await asDeveloper().rpc("extend_clinic_subscription", {
    p_clinic_id: paid.clinicId,
    p_kind: "MONTHLY",
    p_amount_paise: 30_000,
    p_method: "UPI",
    p_reference: `UPI-${tag}`,
    p_paid_on: todayKey(),
    p_valid_until: null,
    p_reason: null,
    p_idempotency_key: randomUUID(),
    p_request_id: `req_${tag}`,
  });
  if (error) throw error;
});

afterAll(async () => {
  await updatePlatformSettings(asDeveloper(), saved, "req_restore");
  await removeAll();
});

/** What the console may know of a clinic (plan §20): nothing more. */
const CLINIC_KEYS = [
  "city",
  "id",
  "members",
  "name",
  "noTrial",
  "owner",
  "plan",
  "signedUpAt",
  "standing",
  "state",
  "type",
  "validUntil",
];

describe("the console's Overview (plan §20.1; D368)", () => {
  it("counts each new clinic once, a trial as Trial, and the one waiting for activation", async () => {
    const after = await getConsoleOverview(admin());
    expect(after.clinics - before.clinics).toBe(3);
    expect(after.standings.TRIAL - before.standings.TRIAL).toBe(1);
    expect(after.standings.ACTIVE - before.standings.ACTIVE).toBe(1);
    expect(after.standings.READ_ONLY - before.standings.READ_ONLY).toBe(1);
    expect(after.noTrial - before.noTrial).toBe(1);
    expect(after.signupsWeek - before.signupsWeek).toBe(3);
    expect(after.signupsMonth - before.signupsMonth).toBe(3);
    expect(after.extensionsMonth - before.extensionsMonth).toBe(1);
    expect(after.today).toBe(todayKey());
  });
});

describe("the console's Clinics (plan §20.2, §20.3; D371)", () => {
  it("finds clinics by what was typed, the newest first, each with only what the console may know", async () => {
    const found = await listConsoleClinics(admin(), { search: tag });
    expect(found.items.map((clinic) => clinic.id).sort()).toEqual(
      [trial.clinicId, waiting.clinicId, paid.clinicId].sort(),
    );
    for (const clinic of found.items) expect(Object.keys(clinic).sort()).toEqual(CLINIC_KEYS);
    const asTrial = found.items.find((clinic) => clinic.id === trial.clinicId)!;
    expect(asTrial).toMatchObject({ plan: "TRIAL", standing: "TRIAL", noTrial: false, members: 1 });
    expect(asTrial.owner.email).toBe(trial.owner.email);

    const byMobile = await listConsoleClinics(admin(), { search: trial.owner.phone.slice(-10) });
    expect(byMobile.items.map((clinic) => clinic.id)).toEqual([trial.clinicId]);
  });

  it("keeps to one filter", async () => {
    const waitingOnes = await listConsoleClinics(admin(), { search: tag, filter: "NO_TRIAL" });
    expect(waitingOnes.items.map((clinic) => clinic.id)).toEqual([waiting.clinicId]);
    expect(waitingOnes.items[0]).toMatchObject({ standing: "READ_ONLY", noTrial: true });
    const active = await listConsoleClinics(admin(), { search: tag, filter: "ACTIVE" });
    expect(active.items.map((clinic) => clinic.id)).toEqual([paid.clinicId]);
  });

  it("opens a clinic with every change recorded to its plan, and refuses one that is not there", async () => {
    const clinic = await getConsoleClinic(admin(), paid.clinicId);
    expect(clinic).toMatchObject({ plan: "MONTHLY", standing: "ACTIVE", noTrial: false });
    expect(clinic.payments).toMatchObject([
      { kind: "MONTHLY", amountPaise: 30_000, reference: `UPI-${tag}`, recordedBy: "Test Developer" },
    ]);
    expect(clinic.payments[0].receiptNumber).toMatch(/^R\/\d{4}-\d{2}\/\d{4,}$/);
    await expect(getConsoleClinic(admin(), randomUUID())).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });
});

describe("the console's Accounts, error log and audit (plan §20.5 – §20.7)", () => {
  it("lists an account with its clinic and role, and the platform admin as theirs", async () => {
    const owner = await listConsoleAccounts(admin(), { search: paid.owner.email });
    expect(owner.items).toMatchObject([
      { email: paid.owner.email, membership: { clinicId: paid.clinicId, role: "OWNER", status: "ACTIVE" } },
    ]);
    expect(owner.items[0].lastSignInAt).not.toBeNull();
    const dev = await listConsoleAccounts(admin(), { search: developer.email });
    expect(dev.items).toMatchObject([{ platformRole: "DEV", membership: null }]);
  });

  it("reads the error log the latest first, whole", async () => {
    const reference = `req_${tag}`;
    const { error } = await admin().from("error_logs").insert({
      source: "API",
      message: "Request failed",
      reference,
      code: "INTERNAL_ERROR",
      clinic_id: paid.clinicId,
    });
    expect(error).toBeNull();
    const [latest] = (await listConsoleErrors(admin(), {})).items;
    expect(latest).toMatchObject({ reference, code: "INTERNAL_ERROR", clinicName: `Paid ${tag}` });
    await admin().from("error_logs").delete().eq("reference", reference);
  });

  it("reads the platform's own actions with who acted and the clinic an extension was for — never a clinic's activity", async () => {
    await updatePlatformSettings(asDeveloper(), { trialDays: saved.trialDays === 45 ? 46 : 45 }, `req_set_${tag}`);
    const page = await listConsoleAudit(admin(), {});
    const [settings] = page.items;
    expect(settings).toMatchObject({ entityType: "platform_settings", actorName: "Test Developer" });
    const extension = page.items.find((entry) => entry.requestId === `req_${tag}`);
    expect(extension).toMatchObject({ entityType: "subscription_payments", clinicName: `Paid ${tag}` });
    // Registering a clinic writes the clinic's own audit row, which the console never reads.
    expect(page.items.some((entry) => entry.entityType === "clinics")).toBe(false);
  });
});

describe("who may read it (plan §20)", () => {
  it("answers no one signed in — not the platform admin's own token, not a clinic's owner", async () => {
    for (const client of [asDeveloper(), trial.owner.tenant.supabase]) {
      const { error } = await client.rpc("console_overview");
      expect(error?.code).toBe("42501");
      // Not even read: no policy and no grant on it (0006).
      const { data } = await client.from("error_logs").select("id");
      expect(data ?? []).toEqual([]);
    }
  });
});
