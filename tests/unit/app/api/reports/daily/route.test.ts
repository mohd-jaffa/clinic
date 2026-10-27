import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getDailyReport } = vi.hoisted(() => ({ getSession: vi.fn(), getDailyReport: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/reports/api", () => ({ getDailyReport }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/reports/daily/route");

const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async (query: string) =>
  answerOf(
    await GET(apiRequest(`/api/reports/daily${query}`, { method: "GET", headers: { authorization: "Bearer tok" } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-27T06:00:00Z"), toFake: ["Date"] });
  getSession.mockResolvedValue(member(["reports.view"]));
  getDailyReport.mockResolvedValue({ collectedPaise: 100 });
});
afterEach(() => vi.useRealTimers());

describe("GET /api/reports/daily (plan §18)", () => {
  it("reads the report, for reports.view", async () => {
    expect(await get("?day=2026-10-27")).toMatchObject({ status: 200, body: { data: { collectedPaise: 100 } } });
    expect(getDailyReport).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      day: "2026-10-27",
    });
  });

  it("refuses a day after today, and someone without reports.view", async () => {
    expect((await get("?day=2026-10-28")).status).toBe(400);
    getSession.mockResolvedValue(member(["payments.view"]));
    expect((await get("?day=2026-10-27")).status).toBe(403);
  });
});
