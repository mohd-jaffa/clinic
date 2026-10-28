import { beforeEach, describe, expect, it, vi } from "vitest";

import { aDeveloperSession, aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listConsoleClinics } = vi.hoisted(() => ({ getSession: vi.fn(), listConsoleClinics: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/admin/api", () => ({ listConsoleClinics }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/admin/clinics/route");

const get = async (query = "") =>
  answerOf(
    await GET(apiRequest(`/api/admin/clinics${query}`, { method: "GET", headers: { authorization: "Bearer tok" } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  listConsoleClinics.mockResolvedValue({ read: true });
});

describe("GET /api/admin/clinics (plan §20.2)", () => {
  it("reads a page of the clinics as the server, searched and filtered", async () => {
    getSession.mockResolvedValue(aDeveloperSession());
    expect(await get("?search=Smile&filter=NO_TRIAL&cursor=25")).toMatchObject({
      status: 200,
      body: { data: { read: true } },
    });
    expect(listConsoleClinics).toHaveBeenCalledWith("service-client", {
      search: "Smile",
      filter: "NO_TRIAL",
      cursor: 25,
    });
  });

  it("refuses a filter it does not know", async () => {
    getSession.mockResolvedValue(aDeveloperSession());
    expect(await get("?filter=PAID")).toMatchObject({ status: 400 });
    expect(listConsoleClinics).not.toHaveBeenCalled();
  });

  it("refuses everyone but the platform admin, a clinic's owner included", async () => {
    getSession.mockResolvedValue(aSession());
    expect(await get()).toMatchObject({ status: 403 });
    expect(listConsoleClinics).not.toHaveBeenCalled();
  });
});
