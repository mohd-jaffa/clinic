import { describe, expect, it } from "vitest";

import { byDay, isLatestMonth, monthOf, thisMonth } from "@/features/expenses/month";

describe("monthOf, thisMonth, isLatestMonth (D328, D330)", () => {
  it("spans a month from its first day to its last, leap years too", () => {
    expect(monthOf("2026-10-24")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthOf("2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthOf("2026-12-31")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("opens on this month, and has none after it to show", () => {
    expect(thisMonth("2026-10-24")).toBe("2026-10-01");
    expect(isLatestMonth("2026-10-01", "2026-10-24")).toBe(true);
    expect(isLatestMonth("2026-09-01", "2026-10-24")).toBe(false);
    expect(thisMonth()).toMatch(/^\d{4}-\d{2}-01$/);
    expect(isLatestMonth(thisMonth())).toBe(true);
  });
});

describe("byDay (D332)", () => {
  it("groups expenses by their day, in the order they came", () => {
    const expenses = [
      { id: "a", day: "2026-10-24" },
      { id: "b", day: "2026-10-24" },
      { id: "c", day: "2026-10-20" },
    ];
    expect(byDay(expenses)).toEqual([
      { day: "2026-10-24", expenses: [expenses[0], expenses[1]] },
      { day: "2026-10-20", expenses: [expenses[2]] },
    ]);
    expect(byDay([])).toEqual([]);
  });
});
