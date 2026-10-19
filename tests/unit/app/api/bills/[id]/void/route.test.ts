import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, voidBill } = vi.hoisted(() => ({ getSession: vi.fn(), voidBill: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/billing/api", () => ({ voidBill }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/bills/[id]/void/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "b-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(await POST(apiRequest("/api/bills/b-1/void", { body, headers: auth }), params));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "payments.edit"]));
  voidBill.mockResolvedValue({ balancePaise: 0, visitToBill: true });
});

describe("POST /api/bills/[id]/void (plan §15.2; D314)", () => {
  it("voids the bill with its reason, for payments.edit", async () => {
    expect(await post({ reason: " Wrong  patient " })).toMatchObject({
      status: 200,
      body: { data: { balancePaise: 0, visitToBill: true } },
    });
    expect(voidBill).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "b-1",
      { reason: "Wrong patient" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses no reason, someone who may not void, and a view-only clinic", async () => {
    expect((await post({ reason: "" })).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view", "payments.create"]));
    expect((await post({ reason: "Typo" })).status).toBe(403);
    const session = member(["patients.view", "payments.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post({ reason: "Typo" })).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(voidBill).not.toHaveBeenCalled();
  });
});
