import { beforeEach, describe, expect, it, vi } from "vitest";

import { aDeveloperSession, aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listConsoleErrors } = vi.hoisted(() => ({ getSession: vi.fn(), listConsoleErrors: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/admin/api", () => ({ listConsoleErrors }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/admin/logs/route");

const get = async (query = "") =>
  answerOf(
    await GET(apiRequest(`/api/admin/logs${query}`, { method: "GET", headers: { authorization: "Bearer tok" } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  listConsoleErrors.mockResolvedValue({ read: true });
});

describe("GET /api/admin/logs (plan §20.6)", () => {
  it("reads a page of the error log as the server", async () => {
    getSession.mockResolvedValue(aDeveloperSession());
    expect(await get("?cursor=25")).toMatchObject({ status: 200, body: { data: { read: true } } });
    expect(listConsoleErrors).toHaveBeenCalledWith("service-client", { cursor: 25 });
  });

  it("refuses everyone but the platform admin, a clinic's owner included", async () => {
    getSession.mockResolvedValue(aSession());
    expect(await get()).toMatchObject({ status: 403 });
    expect(listConsoleErrors).not.toHaveBeenCalled();
  });
});
