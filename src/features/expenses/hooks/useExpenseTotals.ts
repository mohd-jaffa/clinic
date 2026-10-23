"use client";

import type { DayRange } from "@/lib/dates/range";
import { useApiQuery } from "@/lib/query/useApiQuery";

import { expenseTotalsKey } from "../keys";
import type { ExpenseTotals } from "../types";

/** A month's totals (plan §16; D330): the whole and each category's, archived expenses left out. */
export function useExpenseTotals(range: DayRange) {
  return useApiQuery<ExpenseTotals>(expenseTotalsKey(range));
}
