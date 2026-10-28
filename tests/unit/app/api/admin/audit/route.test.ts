import { beforeEach, describe, expect, it, vi } from "vitest";

import { aDeveloperSession, aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listConsoleAudit } = vi.hoisted(() => ({ getSession: vi.fn(), listConsoleAudit: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/admin/api", () => ({ listConsoleAudit }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/admin/audit/route");

const get = async (query = "") =>
  answerOf(
    await GET(apiRequest(`/api/admin/audit${query}`, { method: "GET", headers: { authorization: "Bearer tok" } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  listConsoleAudit.mockResolvedValue({ read: true });
});

describe("GET /api/admin/audit (plan §20.7)", () => {
  it("reads a page of the platform audit as the server", async () => {
    getSession.mockResolvedValue(aDeveloperSession());
    expect(await get()).toMatchObject({ status: 200, body: { data: { read: true } } });
    expect(listConsoleAudit).toHaveBeenCalledWith("service-client", {});
  });

  it("refuses everyone but the platform admin, a clinic's owner included", async () => {
    getSession.mockResolvedValue(aSession());
    expect(await get()).toMatchObject({ status: 403 });
    expect(listConsoleAudit).not.toHaveBeenCalled();
  });
});
