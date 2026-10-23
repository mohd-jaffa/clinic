import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VALIDATION_MESSAGES } from "@/constants/messages";
import {
  archiveExpenseSchema,
  expenseIdSchema,
  expenseSchema,
  expensesQuerySchema,
  expenseTotalsQuerySchema,
  firstIssue,
} from "@/lib/validation";

const CATEGORY = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const typed = {
  categoryId: CATEGORY,
  amount: "₹1,250.50",
  day: "2026-10-19",
  method: "UPI",
  description: "  AC  repair ",
};
const issue = (input: unknown) => {
  const parsed = expenseSchema.safeParse(input);
  return parsed.success ? null : firstIssue(parsed.error);
};

beforeEach(() => vi.useFakeTimers({ now: new Date("2026-10-19T06:00:00Z"), toFake: ["Date"] }));
afterEach(() => vi.useRealTimers());

describe("expenseSchema (plan §16; D328, D329, D343)", () => {
  it("reads the amount into paise and tidies what it was for — said or not", () => {
    expect(expenseSchema.parse(typed)).toEqual({
      categoryId: CATEGORY,
      amountPaise: 125_050,
      day: "2026-10-19",
      method: "UPI",
      description: "AC repair",
    });
    expect(expenseSchema.parse({ ...typed, description: "" }).description).toBeNull();
  });

  it("asks for a category picked, an amount of more than nothing, a day no later than today, and a method", () => {
    expect(issue({ ...typed, categoryId: "" })).toBe(VALIDATION_MESSAGES.choose("Category"));
    expect(issue({ ...typed, amount: "0" })).toBe(VALIDATION_MESSAGES.moreThanZero("Amount"));
    expect(issue({ ...typed, day: "2026-10-20" })).toBe(VALIDATION_MESSAGES.notAfterToday("Date"));
    expect(issue({ ...typed, method: "CHEQUE" })).toBe(VALIDATION_MESSAGES.choose("Paid by"));
    expect(issue({ ...typed, description: "x".repeat(121) })).not.toBeNull();
  });
});

describe("the expenses' queries and ids (D330, D331)", () => {
  it("read a month, a category, the archived, and a page", () => {
    expect(
      expensesQuerySchema.parse({ from: "2026-10-01", to: "2026-10-31", categoryId: CATEGORY, archived: "true" }),
    ).toEqual({ from: "2026-10-01", to: "2026-10-31", categoryId: CATEGORY, archived: true, cursor: undefined });
    expect(expensesQuerySchema.parse({ from: "2026-10-01", to: "2026-10-31", archived: "false" }).archived).toBe(false);
    expect(expensesQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-31", archived: "yes" }).success).toBe(
      false,
    );
    expect(expenseTotalsQuerySchema.parse({ from: "2026-10-01", to: "2026-10-31" })).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(archiveExpenseSchema.parse({ archived: false })).toEqual({ archived: false });
    expect(archiveExpenseSchema.safeParse({ archived: "no" }).success).toBe(false);
    expect(expenseIdSchema.safeParse("e-1").success).toBe(false);
  });
});
