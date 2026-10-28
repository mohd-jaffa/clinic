// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { getPlatformSettings } = vi.hoisted(() => ({ getPlatformSettings: vi.fn() }));
vi.mock("@/lib/platform/settings", () => ({ getPlatformSettings }));

const { getPlan, toPlanPayment } = await import("@/features/subscription/api");

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as unknown as Tenant;
  return { ...fake, tenant };
}

const paid = {
  id: "sp-2",
  plan: "MONTHLY",
  amount_paise: 30_000,
  method: "UPI",
  reference: "UPI-4821",
  paid_on: "2026-10-12",
  valid_until: "2026-11-12",
  reason: null,
  // 9 PM in Mumbai on the 12th: still the 12th.
  created_at: "2026-10-12T15:30:00.000Z",
};
const given = {
  ...paid,
  id: "sp-1",
  plan: "CUSTOM",
  amount_paise: 0,
  method: null,
  reference: null,
  paid_on: null,
  valid_until: "2026-10-12",
  reason: "Ten days for the move",
  // 1 AM in Mumbai on the 3rd.
  created_at: "2026-10-02T19:30:00.000Z",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-08T06:00:00.000Z"));
  getPlatformSettings.mockResolvedValue({
    ...PLATFORM_SETTING_DEFAULTS,
    monthlyPricePaise: 35_000,
    renewalContactName: "Jaffa",
    renewalContactPhone: "+919845012345",
    renewalUpiId: "clinicdesk@okaxis",
  });
});
afterEach(() => vi.useRealTimers());

describe("getPlan (plan §7.5; D363 – D366)", () => {
  it("reads the plan and its history as the owner, beside the live prices and contact, in one round trip", async () => {
    const { tenant, find } = tenantWith({
      answer: (query) =>
        query.table === "clinic_subscriptions"
          ? { data: { plan: "MONTHLY", valid_until: "2026-11-12" } }
          : { data: [paid, given] },
    });
    expect(await getPlan(tenant)).toEqual({
      plan: "MONTHLY",
      validUntil: "2026-11-12",
      state: "EXPIRING",
      readOnlyFrom: "2026-11-20",
      today: "2026-11-08",
      prices: { monthlyPaise: 35_000, yearlyPaise: 300_000 },
      contact: { name: "Jaffa", phone: "+919845012345", email: null, upiId: "clinicdesk@okaxis" },
      payments: [
        {
          id: "sp-2",
          kind: "MONTHLY",
          amountPaise: 30_000,
          method: "UPI",
          reference: "UPI-4821",
          paidOn: "2026-10-12",
          validUntil: "2026-11-12",
          reason: null,
          recordedOn: "2026-10-12",
        },
        expect.objectContaining({
          kind: "CUSTOM",
          amountPaise: 0,
          reason: "Ten days for the move",
          recordedOn: "2026-10-03",
        }),
      ],
    });
    expect(find("clinic_subscriptions", "eq", "clinic_id", "clinic-1")).toBeDefined();
    const history = find("subscription_payments", "eq", "clinic_id", "clinic-1")!;
    expect(history.calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(history.calls[0][1]).not.toContain("*");
  });

  it("is refused when the plan or its history cannot be read", async () => {
    const plan = tenantWith({
      answer: (query) =>
        query.table === "clinic_subscriptions" ? { error: postgrestError("PGRST116") } : { data: [] },
    });
    await expect(getPlan(plan.tenant)).rejects.toMatchObject({ kind: "NOT_FOUND" });
    const history = tenantWith({
      answer: (query) =>
        query.table === "clinic_subscriptions"
          ? { data: { plan: "TRIAL", valid_until: "2026-11-12" } }
          : { error: postgrestError("42501") },
    });
    await expect(getPlan(history.tenant)).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });

  it("counts the day a change was recorded on the clinic's clock", () => {
    expect(toPlanPayment({ ...given, plan: "CUSTOM", method: null } as never).recordedOn).toBe("2026-10-03");
  });
});
