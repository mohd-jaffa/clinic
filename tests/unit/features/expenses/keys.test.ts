import { describe, expect, it } from "vitest";

import { EXPENSE_ROUTES, expensesKey, expenseTotalsKey } from "@/features/expenses/keys";

const october = { from: "2026-10-01", to: "2026-10-31" };

describe("the expenses' keys (plan §16; D330, D331)", () => {
  it("name a month's list — one category's, or the archived — and its totals", () => {
    expect(expensesKey(october)).toBe("/api/expenses?from=2026-10-01&to=2026-10-31");
    expect(expensesKey(october, "c-1", true)).toBe(
      "/api/expenses?from=2026-10-01&to=2026-10-31&categoryId=c-1&archived=true",
    );
    expect(expenseTotalsKey(october)).toBe("/api/expenses/summary?from=2026-10-01&to=2026-10-31");
  });

  it("make every month's list and totals stale with a change", () => {
    expect(EXPENSE_ROUTES).toEqual(["/api/expenses", "/api/expenses/summary"]);
  });
});
