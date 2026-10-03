"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { ExpenseCategory } from "../types";

/** The clinic's expense categories (plan §9, D40), in its order, archived ones too. */
export function useExpenseCategories() {
  return useApiQuery<ExpenseCategory[]>(apiRoutes.expenseCategories.list);
}
