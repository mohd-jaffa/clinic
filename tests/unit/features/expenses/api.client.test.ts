import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExpensesClient } from "@/features/expenses/api.client";
import type { ExpenseInput } from "@/lib/validation";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const input = { categoryId: "c-1", amount: "500" } as unknown as ExpenseInput;
const sent = () => mockFetch.mock.calls[0] as [string, RequestInit];

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { expenseId: "e-1" } }) });
});

describe("ExpensesClient (plan §30)", () => {
  it("adds an expense with its idempotency key", async () => {
    expect(await ExpensesClient.add({ input, key: "key-1" })).toEqual({ expenseId: "e-1" });
    const [url, init] = sent();
    expect([url, init.method, init.body]).toEqual(["/api/expenses", "POST", JSON.stringify(input)]);
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("key-1");
  });

  it("corrects one, and archives or restores one", async () => {
    await ExpensesClient.change({ expenseId: "e-1", input });
    expect(
      sent()
        .slice(0, 1)
        .concat(sent()[1].method!, sent()[1].body as string),
    ).toEqual(["/api/expenses/e-1", "PATCH", JSON.stringify(input)]);
    mockFetch.mockClear();
    await ExpensesClient.archive({ expenseId: "e-1", archived: true });
    expect([sent()[0], sent()[1].method, sent()[1].body]).toEqual([
      "/api/expenses/e-1/archive",
      "POST",
      JSON.stringify({ archived: true }),
    ]);
  });
});
