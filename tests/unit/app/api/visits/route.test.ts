import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, startVisit } = vi.hoisted(() => ({ getSession: vi.fn(), startVisit: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/visits/records", () => ({ startVisit }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/visits/route");

const P = "0b6f2a1e-3c4d-4e5f-8a9b-1c2d3e4f5a6b";
const D = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(await POST(apiRequest("/api/visits", { method: "POST", headers: auth, body })));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.create"]));
  startVisit.mockResolvedValue({ visitId: "v-1", created: true });
});

describe("POST /api/visits — New visit (D204)", () => {
  it("starts a patient's visit with the doctor chosen, for visits.create", async () => {
    expect(await post({ patientId: P, doctorId: D })).toMatchObject({
      status: 200,
      body: { data: { visitId: "v-1", created: true } },
    });
    expect(startVisit).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { patientId: P, doctorId: D },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses what it cannot read", async () => {
    expect(await post({ patientId: P, doctorId: "" })).toMatchObject({ status: 400 });
    expect(startVisit).not.toHaveBeenCalled();
  });

  it("refuses someone who may only read visits, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view", "visits.view", "visits.edit"]));
    expect((await post({ patientId: P, doctorId: D })).status).toBe(403);
    const session = member(["visits.create"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post({ patientId: P, doctorId: D })).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(startVisit).not.toHaveBeenCalled();
  });
});
