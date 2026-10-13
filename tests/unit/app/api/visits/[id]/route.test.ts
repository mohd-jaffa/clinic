import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getVisit } = vi.hoisted(() => ({ getSession: vi.fn(), getVisit: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/visits/api", () => ({ getVisit }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/visits/[id]/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "v-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async () => answerOf(await GET(apiRequest("/api/visits/v-1", { method: "GET", headers: auth }), params));

beforeEach(() => {
  vi.clearAllMocks();
  getVisit.mockResolvedValue({ id: "v-1", status: "OPEN" });
});

describe("GET /api/visits/[id] (plan §12.2, D195)", () => {
  it("reads the visit's header, for visits.view — a view-only clinic too", async () => {
    const session = member(["patients.view", "visits.view"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await get()).toMatchObject({ status: 200, body: { data: { id: "v-1", status: "OPEN" } } });
    expect(getVisit).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), "v-1");
  });

  it("refuses someone who may not read visits", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.edit"]));
    expect((await get()).status).toBe(403);
    expect(getVisit).not.toHaveBeenCalled();
  });
});
