import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, findImportMatches } = vi.hoisted(() => ({ getSession: vi.fn(), findImportMatches: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/patients/import", () => ({ findImportMatches }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/patients/import/matches/route");

const auth = { authorization: "Bearer tok" };
const post = async (body: unknown) =>
  answerOf(await POST(apiRequest("/api/patients/import/matches", { body, headers: auth })));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(aSession());
  findImportMatches.mockResolvedValue([{ phone: "+919876543210", number: 1012, name: "Rohan Mehta" }]);
});

describe("POST /api/patients/import/matches (plan §10.5, D98)", () => {
  it("answers the owner the clinic's patients on the mobiles asked about, in the body", async () => {
    expect(await post({ phones: ["98765 43210"] })).toMatchObject({ status: 200, body: { data: [{ number: 1012 }] } });
    expect(findImportMatches).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), [
      "+919876543210",
    ]);
  });

  it("is a read, so a view-only clinic still asks it", async () => {
    const session = aSession();
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect((await post({ phones: ["98765 43210"] })).status).toBe(200);
  });

  it("refuses no mobiles, too many, one that is not a mobile, and anyone but the owner", async () => {
    expect((await post({ phones: [] })).status).toBe(400);
    expect((await post({ phones: Array(201).fill("98765 43210") })).status).toBe(400);
    expect((await post({ phones: ["123"] })).status).toBe(400);
    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: ["patients.view"] },
    });
    expect((await post({ phones: ["98765 43210"] })).status).toBe(403);
    expect(findImportMatches).not.toHaveBeenCalled();
  });
});
