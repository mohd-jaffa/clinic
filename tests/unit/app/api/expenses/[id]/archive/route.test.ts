import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, archiveExpense } = vi.hoisted(() => ({ getSession: vi.fn(), archiveExpense: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/expenses/api", () => ({ archiveExpense }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/expenses/[id]/archive/route");

const params = { params: Promise.resolve({ id: "e-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const post = async (body: unknown) =>
  answerOf(
    await POST(apiRequest("/api/expenses/e-1/archive", { body, headers: { authorization: "Bearer tok" } }), params),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["expenses.view", "expenses.edit"]));
  archiveExpense.mockResolvedValue({ expenseId: "e-1", archived: true });
});

describe("POST /api/expenses/[id]/archive (plan §16; D331)", () => {
  it("archives the expense, or restores it, for expenses.edit", async () => {
    expect(await post({ archived: true })).toMatchObject({ status: 200, body: { data: { archived: true } } });
    expect(archiveExpense).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "e-1",
      { archived: true },
      expect.stringMatching(/^req_/),
    );
    await post({ archived: false });
    expect(archiveExpense).toHaveBeenLastCalledWith(expect.anything(), "e-1", { archived: false }, expect.anything());
  });

  it("refuses what it cannot read, and someone who may not archive", async () => {
    expect((await post({ archived: "yes" })).status).toBe(400);
    getSession.mockResolvedValue(member(["expenses.view", "expenses.create"]));
    expect((await post({ archived: true })).status).toBe(403);
    expect(archiveExpense).toHaveBeenCalledTimes(0);
  });
});
