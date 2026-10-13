import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, nextPatient } = vi.hoisted(() => ({ getSession: vi.fn(), nextPatient: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/moves", () => ({ nextPatient }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/queue/next/route");

const A = "0b6f2a1e-3c4d-4e5f-8a9b-1c2d3e4f5a6b";
const D = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(await POST(apiRequest("/api/queue/next", { method: "POST", headers: auth, body })));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "appointments.edit"]));
  nextPatient.mockResolvedValue({ sent: null });
});

describe("POST /api/queue/next — Next patient (D193, D196)", () => {
  it("moves the queue on for the doctor, for appointments.edit, answering who went in", async () => {
    expect(await post({ doctorId: D, appointmentId: A })).toMatchObject({
      status: 200,
      body: { data: { sent: null } },
    });
    expect(nextPatient).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { doctorId: D, appointmentId: A },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses what it cannot read", async () => {
    expect(await post({ appointmentId: A })).toMatchObject({ status: 400 });
    expect(nextPatient).not.toHaveBeenCalled();
  });

  it("refuses someone who may only see, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.view", "visits.view"]));
    expect((await post({ doctorId: D, appointmentId: A })).status).toBe(403);
    const session = member(["appointments.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post({ doctorId: D, appointmentId: A })).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(nextPatient).not.toHaveBeenCalled();
  });
});
