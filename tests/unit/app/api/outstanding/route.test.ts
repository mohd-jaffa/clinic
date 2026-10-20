import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listOutstanding } = vi.hoisted(() => ({ getSession: vi.fn(), listOutstanding: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/billing/payments", () => ({ listOutstanding }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/outstanding/route");

const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async (query: string) =>
  answerOf(
    await GET(apiRequest(`/api/outstanding${query}`, { method: "GET", headers: { authorization: "Bearer tok" } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "payments.view"]));
  listOutstanding.mockResolvedValue({ items: [], nextCursor: null });
});

describe("GET /api/outstanding (plan §15.4; D321)", () => {
  it("reads a page of who owes, for payments.view", async () => {
    expect((await get("?cursor=20")).status).toBe(200);
    expect(listOutstanding).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), { cursor: 20 });
  });

  it("refuses a cursor it cannot read, and someone who does not read payments", async () => {
    expect((await get("?cursor=next")).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view"]));
    expect((await get("")).status).toBe(403);
    expect(listOutstanding).not.toHaveBeenCalled();
  });
});
