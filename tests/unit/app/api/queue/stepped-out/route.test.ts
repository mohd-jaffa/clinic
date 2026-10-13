import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, markSteppedOut } = vi.hoisted(() => ({ getSession: vi.fn(), markSteppedOut: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/moves", () => ({ markSteppedOut }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/queue/stepped-out/route");

const A = "0b6f2a1e-3c4d-4e5f-8a9b-1c2d3e4f5a6b";
const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(await POST(apiRequest("/api/queue/stepped-out", { method: "POST", headers: auth, body })));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "appointments.edit"]));
  markSteppedOut.mockResolvedValue({ steppedOutAt: "2026-10-13T05:00:00Z" });
});

describe("POST /api/queue/stepped-out — Stepped out (D198)", () => {
  it("marks a waiting patient stepped out, for appointments.edit, answering since when", async () => {
    expect(await post({ appointmentId: A, out: true })).toMatchObject({
      status: 200,
      body: { data: { steppedOutAt: "2026-10-13T05:00:00Z" } },
    });
    expect(markSteppedOut).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { appointmentId: A, out: true },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses what it cannot read", async () => {
    expect(await post({ appointmentId: A, out: "yes" })).toMatchObject({ status: 400 });
    expect(markSteppedOut).not.toHaveBeenCalled();
  });

  it("refuses someone who may only see, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.view", "visits.view"]));
    expect((await post({ appointmentId: A, out: true })).status).toBe(403);
    const session = member(["appointments.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post({ appointmentId: A, out: true })).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(markSteppedOut).not.toHaveBeenCalled();
  });
});
