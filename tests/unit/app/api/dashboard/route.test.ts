import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getDashboard } = vi.hoisted(() => ({ getSession: vi.fn(), getDashboard: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/dashboard/api", () => ({ getDashboard }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/dashboard/route");

const get = async () =>
  answerOf(await GET(apiRequest("/api/dashboard", { method: "GET", headers: { authorization: "Bearer tok" } })));

beforeEach(() => {
  vi.clearAllMocks();
  getDashboard.mockResolvedValue({ today: "2026-10-27" });
});

describe("GET /api/dashboard (plan §17)", () => {
  it("reads Home for any member of the clinic, each section by its own permission", async () => {
    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: [] },
    });
    expect(await get()).toMatchObject({ status: 200, body: { data: { today: "2026-10-27" } } });
    expect(getDashboard).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }));
  });

  it("asks for a session first", async () => {
    expect((await answerOf(await GET(apiRequest("/api/dashboard", { method: "GET" })))).status).toBe(401);
    expect(getDashboard).not.toHaveBeenCalled();
  });
});
