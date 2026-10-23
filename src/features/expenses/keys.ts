import type { DayRange } from "@/lib/dates/range";
import { apiRoutes, withQuery } from "@/lib/query/keys";

/** A month's expenses (D330 – D332): its days, one category or every one, in use or archived. */
export const expensesKey = ({ from, to }: DayRange, categoryId?: string, archived = false) =>
  withQuery(apiRoutes.expenses.list, { from, to, categoryId, archived: archived ? "true" : undefined });

/** A month's totals (D330). */
export const expenseTotalsKey = ({ from, to }: DayRange) => withQuery(apiRoutes.expenses.summary, { from, to });

/** What an expense added, corrected, archived or restored makes stale: every month's list and totals. */
export const EXPENSE_ROUTES = [apiRoutes.expenses.list, apiRoutes.expenses.summary];
