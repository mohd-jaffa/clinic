import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, sendIn } = vi.hoisted(() => ({ getSession: vi.fn(), sendIn: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/moves", () => ({ sendIn }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/queue/send-in/route");

const A = "0b6f2a1e-3c4d-4e5f-8a9b-1c2d3e4f5a6b";
const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(await POST(apiRequest("/api/queue/send-in", { method: "POST", headers: auth, body })));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "appointments.edit"]));
  sendIn.mockResolvedValue({ visitId: "v-1" });
});

describe("POST /api/queue/send-in — Send in (plan §11.4, D192)", () => {
  it("sends a waiting patient in with what becomes of those in, for appointments.edit, answering the visit", async () => {
    expect(await post({ appointmentId: A, others: "KEEP" })).toMatchObject({
      status: 200,
      body: { data: { visitId: "v-1" } },
    });
    expect(sendIn).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { appointmentId: A, others: "KEEP" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses what it cannot read", async () => {
    expect(await post({ appointmentId: A, others: "LATER" })).toMatchObject({ status: 400 });
    expect(sendIn).not.toHaveBeenCalled();
  });

  it("refuses someone who may only see, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.view", "visits.view"]));
    expect((await post({ appointmentId: A, others: "KEEP" })).status).toBe(403);
    const session = member(["appointments.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post({ appointmentId: A, others: "KEEP" })).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(sendIn).not.toHaveBeenCalled();
  });
});
