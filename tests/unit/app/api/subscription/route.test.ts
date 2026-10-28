import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getPlan } = vi.hoisted(() => ({ getSession: vi.fn(), getPlan: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/subscription/api", () => ({ getPlan }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/subscription/route");

const get = async () =>
  answerOf(await GET(apiRequest("/api/subscription", { method: "GET", headers: { authorization: "Bearer tok" } })));

beforeEach(() => {
  vi.clearAllMocks();
  getPlan.mockResolvedValue({ plan: "MONTHLY" });
});

describe("GET /api/subscription (plan §7.5)", () => {
  it("reads the plan for the owner, a view-only clinic's included", async () => {
    const session = aSession();
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await get()).toMatchObject({ status: 200, body: { data: { plan: "MONTHLY" } } });
    expect(getPlan).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1", role: "OWNER" }));
  });

  it("refuses anyone but the owner, whatever they may do", async () => {
    const session = aSession();
    getSession.mockResolvedValue({ ...session, membership: { ...session.membership!, role: "STAFF" } });
    expect(await get()).toMatchObject({ status: 403 });
    expect(getPlan).not.toHaveBeenCalled();
  });

  it("asks for a session first", async () => {
    expect((await answerOf(await GET(apiRequest("/api/subscription", { method: "GET" })))).status).toBe(401);
  });
});
