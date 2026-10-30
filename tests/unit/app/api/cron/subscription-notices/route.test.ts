import { beforeEach, describe, expect, it, vi } from "vitest";

import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const SECRET = "a-cron-secret-of-at-least-thirty-two-chars";
const { sendSubscriptionNotices } = vi.hoisted(() => ({ sendSubscriptionNotices: vi.fn() }));
vi.mock("@/features/subscription/notices", () => ({ sendSubscriptionNotices }));
vi.mock("@/lib/supabase/server", () => supabaseClients);
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => ({ CRON_SECRET: SECRET }) }));

const { POST } = await import("@/app/api/cron/subscription-notices/route");

const post = async (authorization?: string) =>
  answerOf(
    await POST(
      apiRequest("/api/cron/subscription-notices", {
        body: {},
        headers: authorization ? { authorization } : {},
      }),
    ),
  );

beforeEach(() => {
  vi.clearAllMocks();
  sendSubscriptionNotices.mockResolvedValue({ sent: 3, failed: 1 });
});

describe("POST /api/cron/subscription-notices (plan §22; D382)", () => {
  it("runs the daily plan emails as the server, for the scheduler's secret", async () => {
    expect(await post(`Bearer ${SECRET}`)).toMatchObject({ status: 200, body: { data: { sent: 3, failed: 1 } } });
    expect(sendSubscriptionNotices).toHaveBeenCalledWith("service-client", expect.stringMatching(/^req_/));
  });

  it("refuses anyone without it, in the envelope", async () => {
    for (const authorization of [undefined, "Bearer wrong"]) {
      expect(await post(authorization)).toMatchObject({
        status: 401,
        body: { success: false, error: { code: "CRON_SECRET_INVALID" } },
      });
    }
    expect(sendSubscriptionNotices).not.toHaveBeenCalled();
  });
});
