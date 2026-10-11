import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, changeAppointmentStatus } = vi.hoisted(() => ({
  getSession: vi.fn(),
  changeAppointmentStatus: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/api", () => ({ changeAppointmentStatus }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/appointments/[id]/status/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "a-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(await POST(apiRequest("/api/appointments/a-1/status", { method: "POST", body, headers: auth }), params));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "appointments.cancel"]));
  changeAppointmentStatus.mockResolvedValue({ id: "a-1", status: "CANCELLED" });
});

describe("POST /api/appointments/[id]/status (plan §11.2)", () => {
  it("sets the status as parsed, leaving its own permission to the status asked", async () => {
    expect(await post({ status: "CANCELLED", reason: " Patient asked " })).toMatchObject({
      status: 200,
      body: { data: { status: "CANCELLED" } },
    });
    expect(changeAppointmentStatus).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "a-1",
      { status: "CANCELLED", reason: "Patient asked" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a cancellation with no reason, someone who reaches no patient, and a view-only clinic", async () => {
    expect(await post({ status: "CANCELLED" })).toMatchObject({ status: 400 });
    getSession.mockResolvedValue(member([]));
    expect((await post({ status: "CONFIRMED" })).status).toBe(403);
    const session = member(["patients.view", "appointments.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post({ status: "CONFIRMED" })).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(changeAppointmentStatus).not.toHaveBeenCalled();
  });
});
