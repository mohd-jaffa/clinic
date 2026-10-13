import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getVisit, updateVisit } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getVisit: vi.fn(),
  updateVisit: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/visits/api", () => ({ getVisit }));
vi.mock("@/features/visits/records", () => ({ updateVisit }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, PATCH } = await import("@/app/api/visits/[id]/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "v-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async () => answerOf(await GET(apiRequest("/api/visits/v-1", { method: "GET", headers: auth }), params));
const patch = async (body: unknown) =>
  answerOf(await PATCH(apiRequest("/api/visits/v-1", { method: "PATCH", headers: auth, body }), params));
const followUp = { section: "FOLLOW_UP", changes: { followUpOn: "2026-10-20" }, seen: { followUpOn: null } };

beforeEach(() => {
  vi.clearAllMocks();
  getVisit.mockResolvedValue({ id: "v-1", status: "OPEN" });
  updateVisit.mockResolvedValue({ followUpOn: "2026-10-20" });
});

describe("GET /api/visits/[id] (plan §12.2, D195)", () => {
  it("reads the visit, for visits.view — a view-only clinic too", async () => {
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

describe("PATCH /api/visits/[id] — a section saved alone (D202, D205)", () => {
  it("saves the notes or the follow-up with what was read of it, for visits.edit", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.edit"]));
    expect(await patch(followUp)).toMatchObject({ status: 200, body: { data: { followUpOn: "2026-10-20" } } });
    expect(updateVisit).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "v-1",
      followUp,
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses what it cannot read", async () => {
    getSession.mockResolvedValue(member(["visits.edit"]));
    expect(await patch({ section: "VITALS", changes: {}, seen: {} })).toMatchObject({ status: 400 });
    expect(updateVisit).not.toHaveBeenCalled();
  });

  it("refuses someone who may only take vitals, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.create"]));
    expect((await patch(followUp)).status).toBe(403);
    const session = member(["visits.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await patch(followUp)).toMatchObject({ status: 422, body: { error: { code: "CLINIC_PLAN_EXPIRED" } } });
    expect(updateVisit).not.toHaveBeenCalled();
  });
});
