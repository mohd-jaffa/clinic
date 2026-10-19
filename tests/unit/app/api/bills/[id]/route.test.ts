import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getBill } = vi.hoisted(() => ({ getSession: vi.fn(), getBill: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/billing/api", () => ({ getBill }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/bills/[id]/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "b-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async () => answerOf(await GET(apiRequest("/api/bills/b-1", { method: "GET", headers: auth }), params));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "payments.view"]));
  getBill.mockResolvedValue({ id: "b-1", number: "2026-27/0042" });
});

describe("GET /api/bills/[id] (plan §15.2; D314)", () => {
  it("reads the bill for whoever reads bills", async () => {
    expect(await get()).toMatchObject({ status: 200, body: { data: { id: "b-1", number: "2026-27/0042" } } });
    expect(getBill).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), "b-1");
  });

  it("refuses someone who may not read bills", async () => {
    getSession.mockResolvedValue(member(["patients.view", "payments.create"]));
    expect((await get()).status).toBe(403);
    expect(getBill).not.toHaveBeenCalled();
  });
});
