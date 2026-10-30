import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listActivity } = vi.hoisted(() => ({ getSession: vi.fn(), listActivity: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/activity/api", () => ({ listActivity }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/activity/route");

const get = async (query = "") =>
  answerOf(await GET(apiRequest(`/api/activity${query}`, { method: "GET", headers: { authorization: "Bearer tok" } })));

beforeEach(() => {
  vi.clearAllMocks();
  listActivity.mockResolvedValue({ items: [{ id: "a-1" }], nextCursor: null });
});

describe("GET /api/activity (plan §19)", () => {
  it("reads a page for the owner, kept to what was asked — a view-only clinic's too", async () => {
    const session = aSession();
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await get("?kind=TEAM&cursor=20")).toMatchObject({
      status: 200,
      body: { data: { items: [{ id: "a-1" }] } },
    });
    expect(listActivity).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      kind: "TEAM",
      cursor: 20,
    });
  });

  it("refuses anyone but the owner, and a kind it does not know", async () => {
    getSession.mockResolvedValue(aSession());
    expect((await get("?kind=LEDGERS")).status).toBe(400);
    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: [] },
    });
    expect((await get()).status).toBe(403);
    expect(listActivity).toHaveBeenCalledTimes(0);
  });
});
