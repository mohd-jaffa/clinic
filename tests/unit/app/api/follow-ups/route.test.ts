import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listFollowUps } = vi.hoisted(() => ({ getSession: vi.fn(), listFollowUps: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/treatments/api", () => ({ listFollowUps }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/follow-ups/route");

const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async (query: string) => answerOf(await GET(apiRequest(`/api/follow-ups${query}`, { headers: auth })));

beforeEach(() => {
  vi.clearAllMocks();
  listFollowUps.mockResolvedValue({ items: [{ id: "t-1" }], nextCursor: null });
});

describe("GET /api/follow-ups (plan §14.3, D267)", () => {
  it("reads a page of a tab for appointments.view, or for visits.view", async () => {
    for (const permission of ["appointments.view", "visits.view"]) {
      getSession.mockResolvedValue(member(["patients.view", permission]));
      expect(await get("?tab=OVERDUE&cursor=20")).toMatchObject({
        status: 200,
        body: { data: { items: [{ id: "t-1" }], nextCursor: null } },
      });
    }
    expect(listFollowUps).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      tab: "OVERDUE",
      cursor: 20,
    });
  });

  it("refuses a tab it does not know, and someone who sees neither appointments nor visits", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.view"]));
    expect((await get("?tab=SOMEDAY")).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view", "payments.view"]));
    expect((await get("?tab=TODAY")).status).toBe(403);
    expect(listFollowUps).not.toHaveBeenCalled();
  });
});
