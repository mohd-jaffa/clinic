import type { PaymentMethod } from "@/constants/statuses";

/**
 * An expense (plan §16; D328 – D333): its category — the clinic's own, kept
 * by name though archived since — what it was for, how much, its day, how it
 * was paid, and since when it is archived, if it is.
 */
export interface Expense {
  id: string;
  category: { id: string; name: string };
  description: string | null;
  amountPaise: number;
  /** Its day in the clinic's timezone. */
  day: string;
  method: PaymentMethod;
  archivedAt: string | null;
}

/** A month's totals (D330): the whole, and each category's — archived expenses left out (D331). */
export interface ExpenseTotals {
  totalPaise: number;
  categories: { id: string; name: string; totalPaise: number }[];
}

/** What adding an expense answers: the expense, once per key. */
export interface ExpenseAdded {
  expenseId: string;
}
