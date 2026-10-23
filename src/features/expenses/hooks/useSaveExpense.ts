"use client";

import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { requestKeys } from "@/lib/api/request-key";
import { formatPaise } from "@/lib/format/currency";
import { parseRupees } from "@/lib/money";
import { useApiMutation } from "@/lib/query/useApiMutation";
import type { ExpenseInput } from "@/lib/validation";

import { ExpensesClient } from "../api.client";
import { EXPENSE_ROUTES } from "../keys";
import type { Expense } from "../types";

const { expenses: words } = UI_TEXT;

/**
 * Saving an expense (plan §16; D328, D329, D333): a new one added — sent
 * twice, it is added once (its idempotency key) — or one corrected. Saved,
 * `onDone` closes the sheet, the card says so — "₹500 for Rent added" — and
 * the month's list and totals are read again.
 */
export function useSaveExpense({ expense, onDone }: { expense: Expense | null; onDone: () => void }) {
  const respond = useResponse();
  const [keys] = useState(requestKeys);
  const adding = useApiMutation(ExpensesClient.add, {
    revalidate: EXPENSE_ROUTES,
    onError: (failure) => respond.failure(failure, { title: words.notAdded }),
  });
  const changing = useApiMutation(ExpensesClient.change, {
    revalidate: EXPENSE_ROUTES,
    onSuccess: () => {
      onDone();
      respond.success({ title: words.saved });
    },
    onError: (failure) => respond.failure(failure, { title: words.notSaved }),
  });
  return {
    submitting: adding.submitting || changing.submitting,
    save: async (input: ExpenseInput, category: string) => {
      if (expense) {
        await changing.submit({ expenseId: expense.id, input });
        return;
      }
      const added = await adding.submit({ input, key: keys.keyFor(input) });
      if (added === undefined) return;
      keys.settle();
      onDone();
      // The amount was read already, to be sent: it is one.
      respond.success({ title: words.added(formatPaise(parseRupees(input.amount)!), category) });
    },
  };
}
