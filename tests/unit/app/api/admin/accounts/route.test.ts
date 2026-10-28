import { beforeEach, describe, expect, it, vi } from "vitest";

import { aDeveloperSession, aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listConsoleAccounts } = vi.hoisted(() => ({ getSession: vi.fn(), listConsoleAccounts: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/admin/api", () => ({ listConsoleAccounts }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/admin/accounts/route");

const get = async (query = "") =>
  answerOf(
    await GET(apiRequest(`/api/admin/accounts${query}`, { method: "GET", headers: { authorization: "Bearer tok" } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  listConsoleAccounts.mockResolvedValue({ read: true });
});

describe("GET /api/admin/accounts (plan §20.5)", () => {
  it("reads a page of the accounts as the server, searched", async () => {
    getSession.mockResolvedValue(aDeveloperSession());
    expect(await get("?search=asha")).toMatchObject({ status: 200, body: { data: { read: true } } });
    expect(listConsoleAccounts).toHaveBeenCalledWith("service-client", { search: "asha" });
  });

  it("refuses everyone but the platform admin, a clinic's owner included", async () => {
    getSession.mockResolvedValue(aSession());
    expect(await get()).toMatchObject({ status: 403 });
    expect(listConsoleAccounts).not.toHaveBeenCalled();
  });
});
