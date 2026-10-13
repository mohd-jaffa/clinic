import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, markDone } = vi.hoisted(() => ({ getSession: vi.fn(), markDone: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/moves", () => ({ markDone }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/queue/done/route");

const A = "0b6f2a1e-3c4d-4e5f-8a9b-1c2d3e4f5a6b";
const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(await POST(apiRequest("/api/queue/done", { method: "POST", headers: auth, body })));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "appointments.edit"]));
  markDone.mockResolvedValue({ appointmentId: A });
});

describe("POST /api/queue/done — Done (plan §11.4, D43)", () => {
  it("marks the patient in done, for appointments.edit", async () => {
    expect(await post({ appointmentId: A })).toMatchObject({ status: 200, body: { data: { appointmentId: A } } });
    expect(markDone).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { appointmentId: A },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses what it cannot read", async () => {
    expect(await post({ appointmentId: "not-an-id" })).toMatchObject({ status: 400 });
    expect(markDone).not.toHaveBeenCalled();
  });

  it("refuses someone who may only see, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.view", "visits.view"]));
    expect((await post({ appointmentId: A })).status).toBe(403);
    const session = member(["appointments.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post({ appointmentId: A })).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(markDone).not.toHaveBeenCalled();
  });
});
