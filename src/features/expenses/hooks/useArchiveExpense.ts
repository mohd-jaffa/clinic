"use client";

import { Archive } from "lucide-react";
import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { formatPaise } from "@/lib/format/currency";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { ExpensesClient } from "../api.client";
import { EXPENSE_ROUTES } from "../keys";
import type { Expense } from "../types";

const { expenses: words } = UI_TEXT;

/**
 * Archiving an expense, or restoring it (plan §16; D331). Archive asks first
 * (AGENTS.md §23) — it leaves the month's totals — and answers whether it
 * was archived, so the sheet it was asked from can close; Restore only brings
 * it back, unasked. Either way the month's list and totals are read again.
 */
export function useArchiveExpense() {
  const respond = useResponse();
  // The expense being restored, so only its row shows it.
  const [restoring, setRestoring] = useState<string | null>(null);
  const mutation = useApiMutation(ExpensesClient.archive, {
    revalidate: EXPENSE_ROUTES,
    onSuccess: ({ archived }) => respond.success({ title: archived ? words.archived : words.restored }),
    onError: (failure) => respond.failure(failure, { title: words.notChanged }),
  });

  const archive = async (expense: Expense): Promise<boolean> => {
    const sure = await respond.confirm({
      title: words.archiveAsk(formatPaise(expense.amountPaise), expense.category.name),
      message: words.archiveAskMessage,
      confirmLabel: UI_TEXT.actions.archive,
      confirmIcon: Archive,
    });
    if (!sure) return false;
    return (await mutation.submit({ expenseId: expense.id, archived: true })) !== undefined;
  };

  const restore = async (expense: Expense) => {
    setRestoring(expense.id);
    await mutation.submit({ expenseId: expense.id, archived: false });
    setRestoring(null);
  };

  return { archive, restore, restoring, archiving: mutation.submitting && restoring === null };
}
