import { patchJson, postJson, postOnce } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { ExpenseInput } from "@/lib/validation";

import type { ExpenseAdded } from "./types";

/**
 * The expenses endpoints the browser calls (plan §30): one added, once per
 * key, however often it is sent; one corrected; one archived or restored.
 */
export const ExpensesClient = {
  add: ({ input, key }: { input: ExpenseInput; key: string }) =>
    postOnce<ExpenseAdded>(apiRoutes.expenses.list, input, key),
  change: ({ expenseId, input }: { expenseId: string; input: ExpenseInput }) =>
    patchJson<{ expenseId: string }>(apiRoutes.expenses.one(expenseId), input),
  archive: ({ expenseId, archived }: { expenseId: string; archived: boolean }) =>
    postJson<{ expenseId: string; archived: boolean }>(apiRoutes.expenses.archive(expenseId), { archived }),
};
