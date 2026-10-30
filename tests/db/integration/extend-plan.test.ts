import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { extendPlan } from "@/features/admin/extend";
import { periodEnd } from "@/features/subscription/state";
import { addDaysKey, financialYear, todayKey } from "@/lib/dates/calendar";
import { formatDate } from "@/lib/format/date";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { ExtendPlanPayload } from "@/lib/validation";
import {
  admin,
  makeDeveloper,
  registerClinic,
  removeAll,
  setValidUntil,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";
import { latestMessageTo, messagesTo } from "@tests/support/mailpit";

/**
 * Extend plan (plan §7.4; R11.3, D373 – D376), against the local Supabase
 * and Mailpit: as the DEV, through the console's own function — a month or a
 * year runs on as the console showed it would, once per key however often it
 * is sent; a date set free carries its reason; the owner is emailed each
 * change, once; and no one but the DEV extends anything.
 */
let developer: SignedIn;
let clinic: TestClinic;
const tag = randomUUID().slice(0, 8);
const name = `Extend ${tag}`;

const asDeveloper = () => createSupabaseAnonClient(developer.session.accessToken);
const inbox = async () => (await messagesTo(clinic.owner.email)).length;

/** The owner's next email: once more than `seen` have come — sign-up sent one before any of these. */
async function nextMail(seen: number) {
  for (let attempt = 0; attempt < 20 && (await inbox()) <= seen; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return latestMessageTo(clinic.owner.email);
}
const extend = (extension: ExtendPlanPayload, key = randomUUID(), requestId = `req_${randomUUID()}`) =>
  extendPlan(asDeveloper(), clinic.clinicId, extension, key, { requestId, userId: developer.userId });

/** A month paid for by UPI today. */
const month: ExtendPlanPayload = {
  kind: "MONTHLY",
  amountPaise: 30_000,
  method: "UPI",
  paidOn: todayKey(),
  reference: `UPI-${tag}`,
  validUntil: null,
  reason: null,
};

/** Days given free, to a date. */
const given = (validUntil: string, reason: string): ExtendPlanPayload => ({
  kind: "CUSTOM",
  amountPaise: 0,
  method: null,
  paidOn: null,
  reference: null,
  validUntil,
  reason,
});

beforeAll(async () => {
  developer = await makeDeveloper();
  clinic = await registerClinic({ clinicName: name });
});

afterAll(removeAll);

describe("extending a plan (plan §7.4)", () => {
  it("runs a month on from the last day as the console showed, records it once per key, and emails the owner once", async () => {
    const lastDay = addDaysKey(todayKey(), 5);
    await setValidUntil(clinic.clinicId, lastDay);
    const key = randomUUID();
    const requestId = `req_${tag}`;
    const seen = await inbox();

    const extended = await extend(month, key, requestId);
    const until = periodEnd("MONTHLY", lastDay, todayKey());
    expect(extended).toMatchObject({
      clinic: { name, plan: "MONTHLY", validUntil: until, state: "ACTIVE", noTrial: false },
      payment: {
        kind: "MONTHLY",
        amountPaise: 30_000,
        method: "UPI",
        validFrom: lastDay,
        validUntil: until,
        recordedBy: "Test Developer",
        receiptNumber: expect.stringMatching(new RegExp(`^R/${financialYear(todayKey())}/\\d{4,}$`)),
      },
      emailSent: true,
    });
    expect(extended.clinic.payments).toHaveLength(1);

    const mail = await nextMail(seen);
    expect(mail.subject).toBe(`${name}'s plan runs until ${formatDate(until)}`);
    expect(mail.text).toContain(`Monthly · ₹300 paid by UPI on ${formatDate(todayKey())}`);
    expect(mail.text).toContain(`Receipt ${extended.payment.receiptNumber}`);
    expect(mail.text).toContain("/settings/plan");

    // The same Extend plan again — a double tap, a save sent again: nothing more recorded, no one emailed.
    const again = await extend(month, key, requestId);
    expect(again).toMatchObject({ payment: { id: extended.payment.id }, emailSent: null });
    expect(again.clinic.validUntil).toBe(until);
    expect(again.clinic.payments).toHaveLength(1);
    expect(await inbox()).toBe(seen + 1);

    const { data: audit } = await admin().from("audit_logs").select("clinic_id, changes").eq("request_id", requestId);
    expect(audit).toEqual([
      expect.objectContaining({ clinic_id: null, changes: expect.objectContaining({ kind: "MONTHLY" }) }),
    ]);
  });

  it("keeps a month's end inside a shorter month, as the console shows it", async () => {
    const year = Number(todayKey().slice(0, 4)) + 1;
    await setValidUntil(clinic.clinicId, `${year}-01-31`);
    const { clinic: monthly } = await extend(month);
    expect(monthly.validUntil).toBe(periodEnd("MONTHLY", `${year}-01-31`, todayKey()));

    await setValidUntil(clinic.clinicId, "2032-02-29");
    const { clinic: yearly } = await extend({ ...month, kind: "YEARLY", amountPaise: 300_000 });
    expect(yearly).toMatchObject({ plan: "YEARLY", validUntil: "2033-02-28" });
    expect(yearly.validUntil).toBe(periodEnd("YEARLY", "2032-02-29", todayKey()));
  });

  it("sets a date free with its reason and no receipt, and says a date moved earlier has changed (D374, D375)", async () => {
    await setValidUntil(clinic.clinicId, addDaysKey(todayKey(), 5));
    const later = addDaysKey(todayKey(), 15);
    const seen = await inbox();
    const free = await extend(given(later, "Ten days for the move"));
    expect(free).toMatchObject({
      clinic: { plan: "YEARLY", validUntil: later },
      payment: { kind: "CUSTOM", amountPaise: 0, receiptNumber: null, reason: "Ten days for the move" },
      emailSent: true,
    });
    const told = await nextMail(seen);
    expect(told.subject).toBe(`${name}'s plan runs until ${formatDate(later)}`);
    expect(told.text).toContain("Set date · No charge · Ten days for the move");
    expect(told.text).not.toContain("Receipt");

    const earlier = addDaysKey(todayKey(), 2);
    await extend(given(earlier, "Ten days given twice"));
    const corrected = await nextMail(seen + 1);
    expect(corrected.subject).toBe(`${name}'s plan runs until ${formatDate(earlier)}`);
    expect(corrected.html).toContain("Your plan&#39;s last day has changed");
  });

  it("refuses a month at ₹0, an extension without its key, and anyone but the DEV", async () => {
    const args = {
      p_clinic_id: clinic.clinicId,
      p_kind: "MONTHLY",
      p_amount_paise: 0,
      p_method: null,
      p_reference: null,
      p_paid_on: null,
      p_valid_until: null,
      p_reason: null,
      p_idempotency_key: randomUUID(),
    };
    const { error: free } = await asDeveloper().rpc("extend_clinic_subscription", args);
    expect(free?.code).toBe("23514");
    const { error: keyless } = await asDeveloper().rpc("extend_clinic_subscription", {
      ...args,
      p_idempotency_key: null,
    });
    expect(keyless?.hint).toBe("IDEMPOTENCY_KEY_REQUIRED");

    const before = await inbox();
    await expect(
      extendPlan(clinic.owner.tenant.supabase, clinic.clinicId, month, randomUUID(), {
        requestId: "req_owner",
        userId: clinic.owner.userId,
      }),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    expect(await inbox()).toBe(before);
  });
});
