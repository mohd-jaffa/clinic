import type { PaymentMethod } from "@/constants/statuses";
import { pageWindow, toPage, type Page } from "@/lib/api/pagination";
import { logActionSafe } from "@/lib/audit/auditLog";
import { changedValues } from "@/lib/audit/changes";
import { fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type { ArchiveExpensePayload, ExpensePayload, ExpensesQuery, ExpenseTotalsQuery } from "@/lib/validation";

import type { Expense, ExpenseAdded, ExpenseTotals } from "./types";

/**
 * Expenses (plan §16; D328 – D333): read through their policy
 * (`expenses.view`), written only through 0033's functions —
 * `create_expense`, `change_expense`, `archive_expense` — which hold the
 * permission, the clinic's plan, the category and the day. Every change is
 * audited, its values: an expense holds nothing clinical.
 */

const TABLE = "expenses";

/** What a row of the list shows: the expense and its category's name, in one query. */
const EXPENSE_COLUMNS =
  "id, description, amount_paise, expense_date, payment_method, archived_at, " +
  "category:expense_categories!expenses_category_id_clinic_id_fkey(id, name)";

interface ExpenseRow {
  id: string;
  description: string | null;
  amount_paise: number;
  expense_date: string;
  payment_method: PaymentMethod;
  archived_at: string | null;
  category: { id: string; name: string };
}

const toExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  category: { id: row.category.id, name: row.category.name },
  description: row.description,
  amountPaise: row.amount_paise,
  day: row.expense_date,
  method: row.payment_method,
  archivedAt: row.archived_at,
});

/** What an expense's audit row records of it: every field, by value — nothing in it is clinical. */
const EXPENSE_AUDITED = ["category_id", "description", "amount_paise", "expense_date", "payment_method"] as const;

/** An expense as 0033's functions take it. */
const toColumns = (expense: ExpensePayload) => ({
  category_id: expense.categoryId,
  description: expense.description,
  amount_paise: expense.amountPaise,
  expense_date: expense.day,
  payment_method: expense.method,
});

/**
 * A page of a month's expenses (plan §16; D330 – D332): its days, newest
 * first, then the latest added — one category's or every one; those in use,
 * or those archived (D331). One more than a page, so it knows whether
 * another follows. One query, on the index of the expenses in use by day, a
 * category's, or the archived.
 */
export async function listExpenses(
  tenant: Tenant,
  { from, to, categoryId, archived, cursor }: ExpensesQuery,
): Promise<Page<Expense>> {
  const start = cursor ?? 0;
  const window = pageWindow(start);
  let query = tenant.supabase
    .from(TABLE)
    .select(EXPENSE_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .gte("expense_date", from)
    .lte("expense_date", to);
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (categoryId) query = query.eq("category_id", categoryId);
  const { data, error } = await query
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(window.from, window.to);
  if (error) throw fromPostgrestError(error);
  return toPage((data as unknown as ExpenseRow[]).map(toExpense), start);
}

/** What expense_totals answers: a category's total, or — with no category — the month's. */
interface TotalRow {
  category_id: string | null;
  category_name: string | null;
  total_paise: number;
}

/**
 * A month's totals (plan §16; D330, D331): the whole and each category's,
 * archived expenses left out, worked out in SQL (`expense_totals`). One call.
 */
export async function getExpenseTotals(tenant: Tenant, { from, to }: ExpenseTotalsQuery): Promise<ExpenseTotals> {
  const { data, error } = await tenant.supabase.rpc("expense_totals", { p_from: from, p_to: to });
  if (error) throw fromPostgrestError(error);
  const rows = (data ?? []) as TotalRow[];
  return {
    totalPaise: Number(rows.find((row) => row.category_id === null)?.total_paise ?? 0),
    categories: rows.flatMap((row) =>
      row.category_id === null
        ? []
        : [{ id: row.category_id, name: row.category_name!, totalPaise: Number(row.total_paise) }],
    ),
  };
}

/**
 * An expense added (plan §16; D328, D329), once per idempotency key —
 * audited when this call added it. Waits on two round trips: the function,
 * the audit row.
 */
export async function createExpense(
  tenant: Tenant,
  expense: ExpensePayload,
  idempotencyKey: string,
  requestId?: string,
): Promise<ExpenseAdded> {
  const { data, error } = await tenant.supabase
    .rpc("create_expense", { p_expense: toColumns(expense), p_idempotency_key: idempotencyKey })
    .single<{ expense_id: string; created: boolean }>();
  if (error) throw fromPostgrestError(error);
  if (data.created) {
    await logActionSafe(tenant, {
      action: "CREATE",
      entityType: TABLE,
      entityId: data.expense_id,
      changes: changedValues(null, toColumns(expense), EXPENSE_AUDITED),
      requestId,
    });
  }
  return { expenseId: data.expense_id };
}

/**
 * An expense of any month corrected (plan §16; D333): its category, amount,
 * day, method and description — audited with what changed, from what to
 * what. Waits on two round trips: the function, the audit row.
 */
export async function changeExpense(
  tenant: Tenant,
  expenseId: string,
  expense: ExpensePayload,
  requestId?: string,
): Promise<{ expenseId: string }> {
  const { data, error } = await tenant.supabase
    .rpc("change_expense", { p_expense_id: expenseId, p_expense: toColumns(expense) })
    .single<{ before: Record<string, unknown>; after: Record<string, unknown> }>();
  if (error) throw fromPostgrestError(error);
  const changes = changedValues(data.before, data.after, EXPENSE_AUDITED);
  if (Object.keys(changes).length > 0) {
    await logActionSafe(tenant, { action: "UPDATE", entityType: TABLE, entityId: expenseId, changes, requestId });
  }
  return { expenseId };
}

/**
 * An expense archived — it leaves the totals — or restored (plan §16;
 * D331), audited when it changed. Waits on two round trips.
 */
export async function archiveExpense(
  tenant: Tenant,
  expenseId: string,
  { archived }: ArchiveExpensePayload,
  requestId?: string,
): Promise<{ expenseId: string; archived: boolean }> {
  const { data, error } = await tenant.supabase
    .rpc("archive_expense", { p_expense_id: expenseId, p_archived: archived })
    .single<{ previously: boolean }>();
  if (error) throw fromPostgrestError(error);
  if (data.previously !== archived) {
    await logActionSafe(tenant, {
      action: archived ? "ARCHIVE" : "RESTORE",
      entityType: TABLE,
      entityId: expenseId,
      requestId,
    });
  }
  return { expenseId, archived };
}
