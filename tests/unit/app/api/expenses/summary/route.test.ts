import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getExpenseTotals } = vi.hoisted(() => ({ getSession: vi.fn(), getExpenseTotals: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/expenses/api", () => ({ getExpenseTotals }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/expenses/summary/route");

const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async (query: string) =>
  answerOf(
    await GET(apiRequest(`/api/expenses/summary${query}`, { method: "GET", headers: { authorization: "Bearer tok" } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["expenses.view"]));
  getExpenseTotals.mockResolvedValue({ totalPaise: 100, categories: [] });
});

describe("GET /api/expenses/summary (plan §16; D330)", () => {
  it("reads a month's totals, for expenses.view", async () => {
    expect(await get("?from=2026-10-01&to=2026-10-31")).toMatchObject({
      status: 200,
      body: { data: { totalPaise: 100 } },
    });
    expect(getExpenseTotals).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("refuses days it cannot read, and someone who does not see expenses", async () => {
    expect((await get("?from=2026-10-01")).status).toBe(400);
    getSession.mockResolvedValue(member(["expenses.create"]));
    expect((await get("?from=2026-10-01&to=2026-10-31")).status).toBe(403);
  });
});
