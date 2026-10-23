import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, changeExpense } = vi.hoisted(() => ({ getSession: vi.fn(), changeExpense: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/expenses/api", () => ({ changeExpense }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { PATCH } = await import("@/app/api/expenses/[id]/route");

const CATEGORY = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const params = { params: Promise.resolve({ id: "e-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const typed = { categoryId: CATEGORY, amount: "3400", day: "2026-09-30", method: "CASH", description: "" };
const patch = async (body: unknown) =>
  answerOf(
    await PATCH(
      apiRequest("/api/expenses/e-1", { method: "PATCH", body, headers: { authorization: "Bearer tok" } }),
      params,
    ),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-19T06:00:00Z"), toFake: ["Date"] });
  getSession.mockResolvedValue(member(["expenses.view", "expenses.edit"]));
  changeExpense.mockResolvedValue({ expenseId: "e-1" });
});

describe("PATCH /api/expenses/[id] (plan §16; D333)", () => {
  it("corrects the expense as parsed — of any month — for expenses.edit", async () => {
    expect(await patch(typed)).toMatchObject({ status: 200, body: { data: { expenseId: "e-1" } } });
    expect(changeExpense).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      "e-1",
      { categoryId: CATEGORY, amountPaise: 340_000, day: "2026-09-30", method: "CASH", description: null },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses one it cannot read, someone who may not correct, and a view-only clinic", async () => {
    expect((await patch({ ...typed, method: "CHEQUE" })).status).toBe(400);
    getSession.mockResolvedValue(member(["expenses.view", "expenses.create"]));
    expect((await patch(typed)).status).toBe(403);
    const session = member(["expenses.edit"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect((await patch(typed)).status).toBe(422);
    expect(changeExpense).not.toHaveBeenCalled();
  });
});
