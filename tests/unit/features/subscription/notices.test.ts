// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NOTICE_BATCH_SIZE } from "@/constants/limits";
import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import type { ClaimedNotice } from "@/features/subscription/notices";
import { fakeSupabase, postgrestError } from "@tests/support/supabase";

const mocks = vi.hoisted(() => ({ captureError: vi.fn(), sendPlanNotice: vi.fn() }));
vi.mock("@/lib/audit/errorLog", () => ({ captureError: mocks.captureError }));
vi.mock("@/lib/mail/nodemailer.provider", () => ({
  createConfiguredMailService: () => ({ sendPlanNotice: mocks.sendPlanNotice }),
}));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://clinicdesk.test" }) }));
vi.mock("@/lib/platform/settings", () => ({ getPlatformSettings: async () => PLATFORM_SETTING_DEFAULTS }));

const { sendSubscriptionNotices } = await import("@/features/subscription/notices");

/** A trial ending in 7 days, claimed for the first time. */
const claimed = (index: number, overrides: Partial<ClaimedNotice> = {}): ClaimedNotice => ({
  clinic_id: `c-${index}`,
  clinic_name: `Clinic ${index}`,
  owner_name: "Asha",
  owner_email: `owner-${index}@clinicdesk.test`,
  plan: "TRIAL",
  valid_until: "2026-11-12",
  today: "2026-11-05",
  read_only_from: "2026-11-20",
  notice: "ENDS_SOON",
  due: "2026-11-05",
  previous_notice: null,
  previous_due: null,
  previous_for: null,
  ...overrides,
});

/** The server's client, answering each claim with the next batch, and then none. */
function serverWith(batches: ClaimedNotice[][], release: { error?: unknown } = {}) {
  const queue = [...batches];
  return fakeSupabase({
    rpc: (name) => (name === "claim_subscription_notices" ? { data: queue.shift() ?? [] } : (release as never)),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.sendPlanNotice.mockResolvedValue(undefined);
});

describe("sendSubscriptionNotices (plan §22; D382 – D386)", () => {
  it("claims the plans due and emails each owner what is due, how to renew, and the Plan screen", async () => {
    const { client, rpcs } = serverWith([[claimed(1), claimed(2, { plan: "MONTHLY", notice: "READ_ONLY" })]]);
    expect(await sendSubscriptionNotices(client, "req_1")).toEqual({ sent: 2, failed: 0 });
    expect(rpcs).toEqual([{ name: "claim_subscription_notices", args: { p_limit: NOTICE_BATCH_SIZE } }]);
    expect(mocks.sendPlanNotice).toHaveBeenCalledWith({
      to: "owner-1@clinicdesk.test",
      name: "Asha",
      clinicName: "Clinic 1",
      notice: "ENDS_SOON",
      trial: true,
      validUntil: "2026-11-12",
      today: "2026-11-05",
      readOnlyFrom: "2026-11-20",
      renewal: PLATFORM_SETTING_DEFAULTS,
      planUrl: "https://clinicdesk.test/settings/plan",
    });
    expect(mocks.sendPlanNotice).toHaveBeenCalledWith(expect.objectContaining({ notice: "READ_ONLY", trial: false }));
  });

  it("releases the emails that did not go, for the next run, and logs each (D383)", async () => {
    const failure = new Error("smtp down");
    mocks.sendPlanNotice.mockImplementation(async ({ to }: { to: string }) => {
      if (to === "owner-2@clinicdesk.test") throw failure;
    });
    const { client, rpcs } = serverWith([[claimed(1), claimed(2)]]);
    expect(await sendSubscriptionNotices(client, "req_2")).toEqual({ sent: 1, failed: 1 });
    expect(rpcs[1]).toEqual({ name: "release_subscription_notices", args: { p_claims: [claimed(2)] } });
    expect(mocks.captureError).toHaveBeenCalledWith({
      message: "Could not send a plan email",
      error: failure,
      clinicId: "c-2",
      reference: "req_2",
      context: { notice: "ENDS_SOON" },
    });
  });

  it("claims batch after batch while each is full, and stops at one that is not", async () => {
    const full = Array.from({ length: NOTICE_BATCH_SIZE }, (_, index) => claimed(index));
    const { client, rpcs } = serverWith([full, [claimed(99)]]);
    expect(await sendSubscriptionNotices(client, "req_3")).toEqual({ sent: NOTICE_BATCH_SIZE + 1, failed: 0 });
    expect(rpcs.map((call) => call.name)).toEqual(["claim_subscription_notices", "claim_subscription_notices"]);
  });

  it("begins no batch once its time is up; what is left is caught up tomorrow", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const full = Array.from({ length: NOTICE_BATCH_SIZE }, (_, index) => claimed(index));
    mocks.sendPlanNotice.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 60_000);
    });
    const { client, rpcs } = serverWith([full, full]);
    expect(await sendSubscriptionNotices(client, "req_4")).toEqual({ sent: NOTICE_BATCH_SIZE, failed: 0 });
    expect(rpcs).toHaveLength(1);
  });

  it("says the database's refusal in the app's words", async () => {
    const { client } = fakeSupabase({ rpc: () => ({ error: postgrestError("42501") }) });
    await expect(sendSubscriptionNotices(client, "req_5")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    mocks.sendPlanNotice.mockRejectedValue(new Error("smtp down"));
    const failing = serverWith([[claimed(1)]], { error: postgrestError("42501") });
    await expect(sendSubscriptionNotices(failing.client, "req_6")).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});
