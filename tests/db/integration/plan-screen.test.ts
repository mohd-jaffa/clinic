import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PlatformSettings } from "@/constants/platform";
import { getPlan } from "@/features/subscription/api";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform/settings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import {
  addMember,
  makeDeveloper,
  registerClinic,
  removeAll,
  setValidUntil,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The owner's Plan screen (plan §7.5; R11.1, D363 – D366), against the local
 * Supabase: what the DEV records and sets is what the owner reads — the
 * plan, every change to it the latest first, the live prices and contact —
 * in a view-only clinic too; nobody else in the clinic reads it, nor
 * another clinic's owner.
 */
let developer: SignedIn;
let clinic: TestClinic;
let saved: PlatformSettings;

const asDeveloper = () => createSupabaseAnonClient(developer.session.accessToken);
const extend = (args: Record<string, unknown>) =>
  asDeveloper().rpc("extend_clinic_subscription", {
    p_clinic_id: clinic.clinicId,
    p_kind: "MONTHLY",
    p_amount_paise: 0,
    p_method: null,
    p_reference: null,
    p_paid_on: null,
    p_valid_until: null,
    p_reason: null,
    ...args,
  });

beforeAll(async () => {
  saved = await getPlatformSettings();
  developer = await makeDeveloper();
  clinic = await registerClinic();
});

afterAll(async () => {
  await updatePlatformSettings(asDeveloper(), saved, "req_restore");
  await removeAll();
});

describe("the owner's Plan screen (plan §7.5)", () => {
  it("reads what the DEV recorded and set: the plan, its history the latest first, the prices and the contact", async () => {
    await updatePlatformSettings(
      asDeveloper(),
      {
        monthlyPricePaise: 35_000,
        renewalContactName: "Jaffa",
        renewalContactPhone: "+919845012345",
        renewalContactEmail: null,
        renewalUpiId: "clinicdesk@okaxis",
      },
      "req_plan_contact",
    );
    const given = addDaysKey(todayKey(), 10);
    expect(
      (await extend({ p_kind: "CUSTOM", p_valid_until: given, p_reason: "Ten days for the move" })).error,
    ).toBeNull();
    const { error } = await extend({
      p_amount_paise: 35_000,
      p_method: "UPI",
      p_reference: "UPI-4821",
      p_paid_on: todayKey(),
    });
    expect(error).toBeNull();

    const plan = await getPlan(clinic.owner.tenant);
    expect(plan).toMatchObject({
      plan: "MONTHLY",
      state: "ACTIVE",
      today: todayKey(),
      prices: { monthlyPaise: 35_000, yearlyPaise: saved.yearlyPricePaise },
      contact: { name: "Jaffa", phone: "+919845012345", email: null, upiId: "clinicdesk@okaxis" },
    });
    expect(plan.payments).toMatchObject([
      { kind: "MONTHLY", amountPaise: 35_000, method: "UPI", reference: "UPI-4821", paidOn: todayKey(), reason: null },
      { kind: "CUSTOM", amountPaise: 0, method: null, validUntil: given, reason: "Ten days for the move" },
    ]);
    expect(plan.payments[0].validUntil).toBe(plan.validUntil);
    expect(plan.payments.map((payment) => payment.recordedOn)).toEqual([todayKey(), todayKey()]);
  });

  it("is read in a view-only clinic, which it is how to leave", async () => {
    await setValidUntil(clinic.clinicId, addDaysKey(todayKey(), -60));
    expect(await getPlan(clinic.owner.tenant)).toMatchObject({ state: "READ_ONLY", payments: [{}, {}] });
  });

  it("is the owner's alone: a member who runs the settings and the money, and another clinic's owner, read none of it", async () => {
    const manager = await addMember(clinic.clinicId, {
      permissions: ["settings.manage", "patients.view", "payments.view", "reports.view"],
    });
    await expect(getPlan(manager.tenant!)).rejects.toMatchObject({ kind: "NOT_FOUND" });
    const other = await registerClinic();
    const theirs = await getPlan(other.owner.tenant);
    expect(theirs).toMatchObject({ plan: "TRIAL", payments: [] });
  });
});
