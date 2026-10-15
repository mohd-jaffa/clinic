import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, countFollowUps } = vi.hoisted(() => ({ getSession: vi.fn(), countFollowUps: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/treatments/api", () => ({ countFollowUps }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/follow-ups/counts/route");

const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async () => answerOf(await GET(apiRequest("/api/follow-ups/counts", { headers: auth })));
const COUNTS = { TODAY: 2, OVERDUE: 0, UPCOMING: 5, LAPSED: 1, COMPLETED: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  countFollowUps.mockResolvedValue(COUNTS);
});

describe("GET /api/follow-ups/counts (plan §14.3, D267)", () => {
  it("reads how many each tab holds for appointments.view or visits.view, and refuses anyone else", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view"]));
    expect(await get()).toMatchObject({ status: 200, body: { data: COUNTS } });
    expect(countFollowUps).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }));
    getSession.mockResolvedValue(member(["patients.view"]));
    expect((await get()).status).toBe(403);
    expect(countFollowUps).toHaveBeenCalledTimes(1);
  });
});
