import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, markArrived } = vi.hoisted(() => ({ getSession: vi.fn(), markArrived: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/api", () => ({ markArrived }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/appointments/[id]/arrived/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "a-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async () =>
  answerOf(await POST(apiRequest("/api/appointments/a-1/arrived", { method: "POST", headers: auth }), params));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "appointments.edit"]));
  markArrived.mockResolvedValue({ id: "a-1", token: 7 });
});

describe("POST /api/appointments/[id]/arrived (plan §11.3)", () => {
  it("marks the patient arrived, for appointments.edit, answering their token", async () => {
    expect(await post()).toMatchObject({ status: 200, body: { data: { token: 7 } } });
    expect(markArrived).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "a-1",
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses someone who may only see, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.view"]));
    expect((await post()).status).toBe(403);
    const session = member(["appointments.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post()).toMatchObject({ status: 422, body: { error: { code: "CLINIC_PLAN_EXPIRED" } } });
    expect(markArrived).not.toHaveBeenCalled();
  });
});
