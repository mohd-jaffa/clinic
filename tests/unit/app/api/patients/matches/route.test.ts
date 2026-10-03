import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, findPatientMatches } = vi.hoisted(() => ({ getSession: vi.fn(), findPatientMatches: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/patients/api", () => ({ findPatientMatches }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/patients/matches/route");

const member = (permissions: string[], state: "ACTIVE" | "READ_ONLY" = "ACTIVE") => {
  const session = aSession();
  return {
    ...session,
    membership: { ...session.membership!, role: "STAFF", permissions },
    subscription: { ...session.subscription!, state },
  };
};
const post = (body: unknown) =>
  POST(apiRequest("/api/patients/matches", { method: "POST", body, headers: { authorization: "Bearer tok" } }));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view"]));
  findPatientMatches.mockResolvedValue([{ id: "p-7", name: "Anita Mehta" }]);
});

describe("POST /api/patients/matches (D98, D106)", () => {
  it("lists the patients on a mobile asked in the body, as stored", async () => {
    expect(await answerOf(await post({ phone: "98765 43210" }))).toMatchObject({
      status: 200,
      body: { data: [{ id: "p-7" }] },
    });
    expect(findPatientMatches).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), "+919876543210");
  });

  it("is a read, so a view-only clinic still asks it", async () => {
    getSession.mockResolvedValue(member(["patients.view"], "READ_ONLY"));
    expect((await answerOf(await post({ phone: "98765 43210" }))).status).toBe(200);
  });

  it("refuses part of a mobile, and someone who may not see patients", async () => {
    expect(await answerOf(await post({ phone: "98765" }))).toMatchObject({ status: 400 });
    getSession.mockResolvedValue(member(["expenses.view"]));
    expect(await answerOf(await post({ phone: "98765 43210" }))).toMatchObject({ status: 403 });
    expect(findPatientMatches).not.toHaveBeenCalled();
  });
});
