"use client";

import type { DayRange } from "@/lib/dates/range";
import { useApiPages } from "@/lib/query/useApiPages";

import { expensesKey } from "../keys";
import type { Expense } from "../types";

/**
 * A page at a time of a month's expenses (plan §16; D330 – D332): one
 * category's, or every one's; those in use, or — asked for only once shown
 * (`enabled`) — the archived (D331).
 */
export function useExpenses(
  range: DayRange,
  { categoryId, archived = false, enabled = true }: { categoryId?: string; archived?: boolean; enabled?: boolean } = {},
) {
  return useApiPages<Expense>(enabled ? expensesKey(range, categoryId, archived) : null, {
    list: [range.from, categoryId ?? "", archived].join(":"),
  });
}
