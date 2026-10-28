import { beforeEach, describe, expect, it, vi } from "vitest";

import { aDeveloperSession, aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getConsoleOverview } = vi.hoisted(() => ({ getSession: vi.fn(), getConsoleOverview: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/admin/api", () => ({ getConsoleOverview }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/admin/overview/route");

const get = async (query = "") =>
  answerOf(
    await GET(apiRequest(`/api/admin/overview${query}`, { method: "GET", headers: { authorization: "Bearer tok" } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getConsoleOverview.mockResolvedValue({ read: true });
});

describe("GET /api/admin/overview (plan §20.1)", () => {
  it("reads the Overview as the server, for the platform admin", async () => {
    getSession.mockResolvedValue(aDeveloperSession());
    expect(await get()).toMatchObject({ status: 200, body: { data: { read: true } } });
    expect(getConsoleOverview).toHaveBeenCalledWith("service-client");
  });

  it("refuses everyone but the platform admin, a clinic's owner included", async () => {
    getSession.mockResolvedValue(aSession());
    expect(await get()).toMatchObject({ status: 403 });
    expect(getConsoleOverview).not.toHaveBeenCalled();
  });
});
