import { beforeEach, describe, expect, it, vi } from "vitest";

import { aDeveloperSession, aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getConsoleClinic } = vi.hoisted(() => ({ getSession: vi.fn(), getConsoleClinic: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/admin/api", () => ({ getConsoleClinic }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/admin/clinics/[id]/route");

const get = async (query = "") =>
  answerOf(
    await GET(
      apiRequest(`/api/admin/clinics/c-1${query}`, { method: "GET", headers: { authorization: "Bearer tok" } }),
      { params: Promise.resolve({ id: "c-1" }) },
    ),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getConsoleClinic.mockResolvedValue({ read: true });
});

describe("GET /api/admin/clinics/c-1 (plan §20.3)", () => {
  it("reads one clinic as the server", async () => {
    getSession.mockResolvedValue(aDeveloperSession());
    expect(await get()).toMatchObject({ status: 200, body: { data: { read: true } } });
    expect(getConsoleClinic).toHaveBeenCalledWith("service-client", "c-1");
  });

  it("refuses everyone but the platform admin, a clinic's owner included", async () => {
    getSession.mockResolvedValue(aSession());
    expect(await get()).toMatchObject({ status: 403 });
    expect(getConsoleClinic).not.toHaveBeenCalled();
  });
});
