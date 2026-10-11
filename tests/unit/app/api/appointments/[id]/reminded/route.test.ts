import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, markReminded } = vi.hoisted(() => ({ getSession: vi.fn(), markReminded: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/api", () => ({ markReminded }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/appointments/[id]/reminded/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "a-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async () =>
  answerOf(await POST(apiRequest("/api/appointments/a-1/reminded", { method: "POST", headers: auth }), params));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "appointments.edit"]));
  markReminded.mockResolvedValue({ remindedAt: "2026-10-12T05:00:00Z" });
});

describe("POST /api/appointments/[id]/reminded (plan §22.1, D180)", () => {
  it("notes the reminder, for appointments.edit", async () => {
    expect(await post()).toMatchObject({ status: 200, body: { data: { remindedAt: "2026-10-12T05:00:00Z" } } });
    expect(markReminded).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "a-1",
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses someone who may only see (D182), and a view-only clinic (D181)", async () => {
    getSession.mockResolvedValue(member(["patients.view", "appointments.view"]));
    expect((await post()).status).toBe(403);
    const session = member(["appointments.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post()).toMatchObject({ status: 422, body: { error: { code: "CLINIC_PLAN_EXPIRED" } } });
    expect(markReminded).not.toHaveBeenCalled();
  });
});
