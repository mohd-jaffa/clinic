import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PLATFORM_SETTING_DEFAULTS, type PlatformSettings } from "@/constants/platform";
import { SUBSCRIPTION_STATES } from "@/constants/statuses";
import { getSession } from "@/features/auth/session";
import { subscriptionState } from "@/features/subscription/state";
import { addDaysKey, financialYear, todayKey } from "@/lib/dates/calendar";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform/settings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
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
 * Platform settings and the plan rule (plan §6, §7; R1.4, R1.5, R1.11): the
 * DEV changes a setting and it takes effect at once; the database and the
 * server apply the same rule; the admin extends a plan.
 */
let developer: SignedIn;
let clinic: TestClinic;
let saved: PlatformSettings;

const asDeveloper = () => createSupabaseAnonClient(developer.session.accessToken);

beforeAll(async () => {
  saved = await getPlatformSettings();
  developer = await makeDeveloper();
  clinic = await registerClinic();
});

afterAll(async () => {
  await updatePlatformSettings(asDeveloper(), saved, "req_restore");
  await removeAll();
});

describe("platform settings (plan §6)", () => {
  it("are read by the server, in the app's own names", async () => {
    const settings = await getPlatformSettings();
    expect(Object.keys(settings).sort()).toEqual(Object.keys(PLATFORM_SETTING_DEFAULTS).sort());
  });

  it("change only for the DEV, within their bounds, with a platform audit row of what changed", async () => {
    const requestId = `req_${randomUUID()}`;
    const changed = await updatePlatformSettings(
      asDeveloper(),
      { trialDays: 45, expiryNoticeDays: [10, 3, 1], renewalContactName: "Asha", renewalUpiId: "asha@okicici" },
      requestId,
    );
    expect(changed).toMatchObject({ trialDays: 45, expiryNoticeDays: [10, 3, 1], renewalContactName: "Asha" });

    const { data: audit } = await admin()
      .from("audit_logs")
      .select("clinic_id, actor_id, entity_type, changes")
      .eq("request_id", requestId)
      .single();
    expect(audit).toMatchObject({
      clinic_id: null,
      actor_id: developer.userId,
      entity_type: "platform_settings",
      changes: {
        trial_days: { from: saved.trialDays, to: 45 },
        renewal_contact_name: { from: saved.renewalContactName, to: "Asha" },
      },
    });

    await expect(updatePlatformSettings(asDeveloper(), { graceDays: 61 }, "req_bounds")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(
      updatePlatformSettings(clinic.owner.tenant.supabase, { graceDays: 1 }, "req_owner"),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    const { error } = await asDeveloper().rpc("update_platform_settings", { p_changes: { not_a_setting: 1 } });
    expect(error?.code).toBe("22023");
  });

  it("take effect at once: a longer grace turns a view-only clinic back to full access", async () => {
    await updatePlatformSettings(asDeveloper(), { graceDays: 7 }, "req_grace");
    await setValidUntil(clinic.clinicId, addDaysKey(todayKey(), -10));
    expect((await getSession(admin(), clinic.owner.session.accessToken)).subscription!.state).toBe("READ_ONLY");

    await updatePlatformSettings(asDeveloper(), { graceDays: 14 }, "req_grace");
    expect((await getSession(admin(), clinic.owner.session.accessToken)).subscription!.state).toBe("GRACE");
    const { error } = await clinic.owner.tenant.supabase
      .from("expense_categories")
      .insert({ clinic_id: clinic.clinicId, name: `Lab ${Math.random()}` });
    expect(error).toBeNull();
  });
});

describe("the plan rule (plan §7.2)", () => {
  it("is the same in the database as on the server, for every case", async () => {
    const validUntil = "2026-11-12";
    for (const warning of [0, 7]) {
      for (const grace of [0, 7]) {
        for (let offset = -10; offset <= 20; offset++) {
          const today = addDaysKey(validUntil, offset);
          const { data } = await admin().rpc("subscription_state_for", {
            p_valid_until: validUntil,
            p_today: today,
            p_warning_days: warning,
            p_grace_days: grace,
          });
          expect(data, `${today} w${warning} g${grace}`).toBe(
            subscriptionState({ validUntil, today, warningDays: warning, graceDays: grace }),
          );
          expect(SUBSCRIPTION_STATES).toContain(data);
        }
      }
    }
  });

  it("counts financial years as the server does", async () => {
    for (const day of ["2026-03-31", "2026-04-01", "2027-01-15", "2099-12-31", "2000-04-01"]) {
      const { data } = await admin().rpc("financial_year", { day });
      expect(data, day).toBe(financialYear(day));
    }
  });
});

describe("extending a plan (plan §7.4)", () => {
  it("adds a month from the plan's last day when paid early, with a receipt and a platform audit row", async () => {
    const requestId = `req_${randomUUID()}`;
    const lastDay = addDaysKey(todayKey(), 5);
    await setValidUntil(clinic.clinicId, lastDay);
    const { data, error } = await asDeveloper().rpc("extend_clinic_subscription", {
      p_clinic_id: clinic.clinicId,
      p_kind: "MONTHLY",
      p_amount_paise: 30_000,
      p_method: "UPI",
      p_reference: "UPI-1234",
      p_paid_on: todayKey(),
      p_valid_until: null,
      p_reason: null,
      p_request_id: requestId,
    });
    expect(error).toBeNull();
    const result = data as { subscription: { plan: string; valid_until: string }; payment: Record<string, unknown> };
    const [year, month, day] = lastDay.split("-").map(Number);
    const expected = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    expect(result.subscription).toMatchObject({ plan: "MONTHLY", valid_until: expected });
    expect(result.payment).toMatchObject({
      plan: "MONTHLY",
      amount_paise: 30_000,
      valid_from: lastDay,
      valid_until: expected,
      recorded_by: developer.userId,
      receipt_number: expect.stringMatching(new RegExp(`^R/${financialYear(todayKey())}/\\d{4,}$`)),
    });

    const { data: audit } = await admin()
      .from("audit_logs")
      .select("clinic_id, changes")
      .eq("request_id", requestId)
      .single();
    expect(audit).toMatchObject({ clinic_id: null, changes: { clinic_id: clinic.clinicId, kind: "MONTHLY" } });

    // The owner reads the payment; nobody else's owner does.
    const { data: payments } = await clinic.owner.tenant.supabase.from("subscription_payments").select("id");
    expect(payments).toHaveLength(1);
  });

  it("counts from yesterday when paid late, so the month starts today", async () => {
    await setValidUntil(clinic.clinicId, addDaysKey(todayKey(), -40));
    const { data } = await asDeveloper().rpc("extend_clinic_subscription", {
      p_clinic_id: clinic.clinicId,
      p_kind: "YEARLY",
      p_amount_paise: 300_000,
      p_method: "CASH",
      p_reference: null,
      p_paid_on: todayKey(),
      p_valid_until: null,
      p_reason: null,
    });
    const [year, month, day] = addDaysKey(todayKey(), -1).split("-").map(Number);
    const expected = new Date(Date.UTC(year + 1, month - 1, day)).toISOString().slice(0, 10);
    expect((data as { subscription: { valid_until: string } }).subscription.valid_until).toBe(expected);
  });

  it("sets a date by hand only with a reason, and gives no receipt for nothing paid", async () => {
    const date = addDaysKey(todayKey(), 10);
    const { error: noReason } = await asDeveloper().rpc("extend_clinic_subscription", {
      p_clinic_id: clinic.clinicId,
      p_kind: "CUSTOM",
      p_amount_paise: 0,
      p_method: null,
      p_reference: null,
      p_paid_on: null,
      p_valid_until: date,
      p_reason: null,
    });
    expect(noReason?.code).toBe("23514");

    const { data } = await asDeveloper().rpc("extend_clinic_subscription", {
      p_clinic_id: clinic.clinicId,
      p_kind: "CUSTOM",
      p_amount_paise: 0,
      p_method: null,
      p_reference: null,
      p_paid_on: null,
      p_valid_until: date,
      p_reason: "Ten days to settle in",
    });
    expect(data).toMatchObject({
      subscription: { plan: "YEARLY", valid_until: date },
      payment: { plan: "CUSTOM", receipt_number: null },
    });
  });

  it("refuses an unknown clinic, and anyone but the DEV", async () => {
    const args = {
      p_clinic_id: "00000000-0000-0000-0000-000000000000",
      p_kind: "MONTHLY",
      p_amount_paise: 0,
      p_method: null,
      p_reference: null,
      p_paid_on: null,
      p_valid_until: null,
      p_reason: null,
    };
    const { error: unknown } = await asDeveloper().rpc("extend_clinic_subscription", args);
    expect(unknown?.hint).toBe("RECORD_NOT_FOUND");
    const { error: owner } = await clinic.owner.tenant.supabase.rpc("extend_clinic_subscription", {
      ...args,
      p_clinic_id: clinic.clinicId,
    });
    expect(owner?.code).toBe("42501");
  });
});
