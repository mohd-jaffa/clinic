import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listExpenses, createExpense } = vi.hoisted(() => ({
  getSession: vi.fn(),
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/expenses/api", () => ({ listExpenses, createExpense }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, POST } = await import("@/app/api/expenses/route");

const KEY = "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f";
const CATEGORY = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const typed = {
  categoryId: CATEGORY,
  amount: "1,250.50",
  day: "2026-10-01",
  method: "UPI",
  description: " AC  repair ",
};
const get = async (query: string) =>
  answerOf(await GET(apiRequest(`/api/expenses${query}`, { method: "GET", headers: auth })));
const post = async (body: unknown, key: string | null = KEY) =>
  answerOf(
    await POST(apiRequest("/api/expenses", { body, headers: { ...auth, ...(key && { "Idempotency-Key": key }) } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-19T06:00:00Z"), toFake: ["Date"] });
  getSession.mockResolvedValue(member(["expenses.view", "expenses.create"]));
  listExpenses.mockResolvedValue({ items: [{ id: "e-1" }], nextCursor: null });
  createExpense.mockResolvedValue({ expenseId: "e-1" });
});

describe("GET /api/expenses (plan §16; D330 – D332)", () => {
  it("reads a page of a month's expenses, one category's, in use or archived, for expenses.view — view-only too", async () => {
    const session = member(["expenses.view"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await get(`?from=2026-10-01&to=2026-10-31&categoryId=${CATEGORY}&archived=true&cursor=20`)).toMatchObject({
      status: 200,
      body: { data: { items: [{ id: "e-1" }] } },
    });
    expect(listExpenses).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      from: "2026-10-01",
      to: "2026-10-31",
      categoryId: CATEGORY,
      archived: true,
      cursor: 20,
    });
    await get("?from=2026-10-01&to=2026-10-31");
    expect(listExpenses).toHaveBeenLastCalledWith(expect.anything(), {
      from: "2026-10-01",
      to: "2026-10-31",
      categoryId: undefined,
      archived: false,
      cursor: undefined,
    });
  });

  it("refuses a query it cannot read, and someone who does not see expenses", async () => {
    expect((await get("?from=2026-10-31&to=2026-10-01")).status).toBe(400);
    expect((await get("?from=2026-10-01&to=2026-10-31&archived=maybe")).status).toBe(400);
    expect((await get("?from=2026-10-01&to=2026-10-31&categoryId=rent")).status).toBe(400);
    getSession.mockResolvedValue(member(["expenses.create"]));
    expect((await get("?from=2026-10-01&to=2026-10-31")).status).toBe(403);
    expect(listExpenses).not.toHaveBeenCalled();
  });
});

describe("POST /api/expenses (plan §16; D328, D329)", () => {
  it("adds the expense as parsed, once per key, for expenses.create, and answers 201", async () => {
    expect(await post(typed)).toMatchObject({ status: 201, body: { data: { expenseId: "e-1" } } });
    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { categoryId: CATEGORY, amountPaise: 125_050, day: "2026-10-01", method: "UPI", description: "AC repair" },
      KEY,
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses one it cannot read, one dated later, one without its key, someone who may not add, and a view-only clinic", async () => {
    expect((await post({ ...typed, amount: "0" })).status).toBe(400);
    expect((await post({ ...typed, day: "2026-10-20" })).status).toBe(400);
    expect((await post({ ...typed, categoryId: "" })).status).toBe(400);
    expect(await post(typed, null)).toMatchObject({
      status: 400,
      body: { error: { code: "IDEMPOTENCY_KEY_REQUIRED" } },
    });
    getSession.mockResolvedValue(member(["expenses.view"]));
    expect((await post(typed)).status).toBe(403);
    const session = member(["expenses.create"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post(typed)).toMatchObject({ status: 422, body: { error: { code: "CLINIC_PLAN_EXPIRED" } } });
    expect(createExpense).not.toHaveBeenCalled();
  });
});
