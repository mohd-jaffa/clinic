import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, voidPayment } = vi.hoisted(() => ({ getSession: vi.fn(), voidPayment: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/billing/payments", () => ({ voidPayment }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/payments/[id]/void/route");

const params = { params: Promise.resolve({ id: "pay-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(
    await POST(apiRequest("/api/payments/pay-1/void", { body, headers: { authorization: "Bearer tok" } }), params),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "payments.edit"]));
  voidPayment.mockResolvedValue({ balancePaise: 50_000 });
});

describe("POST /api/payments/[id]/void (plan §15.3; D336)", () => {
  it("voids the payment with its reason, for payments.edit", async () => {
    expect(await post({ reason: " Entered  twice " })).toMatchObject({
      status: 200,
      body: { data: { balancePaise: 50_000 } },
    });
    expect(voidPayment).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "pay-1",
      { reason: "Entered twice" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses no reason, someone who may not void, and a view-only clinic", async () => {
    expect((await post({ reason: "" })).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view", "payments.create"]));
    expect((await post({ reason: "Typo" })).status).toBe(403);
    const session = member(["patients.view", "payments.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect((await post({ reason: "Typo" })).status).toBe(422);
    expect(voidPayment).not.toHaveBeenCalled();
  });
});
