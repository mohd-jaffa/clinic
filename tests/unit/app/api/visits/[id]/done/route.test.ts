import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, finishVisit } = vi.hoisted(() => ({ getSession: vi.fn(), finishVisit: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/visits/records", () => ({ finishVisit }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/visits/[id]/done/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "v-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async () =>
  answerOf(await POST(apiRequest("/api/visits/v-1/done", { method: "POST", headers: auth }), params));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.create"]));
  finishVisit.mockResolvedValue({ visitId: "v-1" });
});

describe("POST /api/visits/[id]/done — Done for a visit from a profile (D204)", () => {
  it("closes it, for visits.create", async () => {
    expect(await post()).toMatchObject({ status: 200, body: { data: { visitId: "v-1" } } });
    expect(finishVisit).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "v-1",
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses someone who may only read visits, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view"]));
    expect((await post()).status).toBe(403);
    const session = member(["visits.create"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post()).toMatchObject({ status: 422, body: { error: { code: "CLINIC_PLAN_EXPIRED" } } });
    expect(finishVisit).not.toHaveBeenCalled();
  });
});
