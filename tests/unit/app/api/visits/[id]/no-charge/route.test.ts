import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, markNoCharge } = vi.hoisted(() => ({ getSession: vi.fn(), markNoCharge: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/billing/checkout", () => ({ markNoCharge }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/visits/[id]/no-charge/route");

const params = { params: Promise.resolve({ id: "v-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(
    await POST(apiRequest("/api/visits/v-1/no-charge", { body, headers: { authorization: "Bearer tok" } }), params),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "payments.create"]));
  markNoCharge.mockResolvedValue({ visitId: "v-1" });
});

describe("POST /api/visits/[id]/no-charge (plan §15.6; D319)", () => {
  it("settles the visit free with its reason, for payments.create", async () => {
    expect(await post({ reason: "OTHER", note: " Staff  family " })).toMatchObject({
      status: 200,
      body: { data: { visitId: "v-1" } },
    });
    expect(markNoCharge).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "v-1",
      { reason: "OTHER", note: "Staff family" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses Other without a note, someone who may not bill, and a view-only clinic", async () => {
    expect((await post({ reason: "OTHER", note: "" })).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view", "payments.view"]));
    expect((await post({ reason: "REVIEW", note: "" })).status).toBe(403);
    const session = member(["patients.view", "payments.create"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect((await post({ reason: "REVIEW", note: "" })).status).toBe(422);
    expect(markNoCharge).not.toHaveBeenCalled();
  });
});
