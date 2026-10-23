"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { PageHeader } from "@/components/ui/page-header";
import { UI_TEXT } from "@/constants/messages";
import { ADD_FORMS } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useExpenseCategories } from "@/features/clinic/hooks/useExpenseCategories";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useAddForm } from "@/hooks/useAddForm";
import { useOpened } from "@/hooks/useOpened";
import { addMonthsKey } from "@/lib/dates/calendar";

import { isLatestMonth, monthOf, thisMonth } from "../month";
import type { Expense } from "../types";
import { ExpenseList } from "./ExpenseList";
import { ExpenseSheet } from "./ExpenseSheet";
import { ExpenseTotals } from "./ExpenseTotals";

const { expenses: words } = UI_TEXT;

/**
 * Expenses — `/expenses` (plan §16; D328 – D333, D343, D344), for
 * `expenses.view`: a month at a time with ‹ › — this month to start, none
 * after it — its total and each category's, then its expenses by day; on a
 * desktop the totals on the left and the list on the right (D330). A
 * category's total, tapped, keeps the list to it. **Add expense** — or the
 * ＋'s Expense (D67) — opens its sheet for `expenses.create`; a row opens it
 * filled, to correct or archive, for `expenses.edit` (D344). In a view-only
 * clinic nothing is written, and it says why.
 */
export function Expenses() {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const adding = useAddForm(ADD_FORMS.expense);
  const opened = useOpened<Expense>();
  const categories = useExpenseCategories().data ?? [];
  const [month, setMonth] = useState(thisMonth);
  const [categoryId, setCategoryId] = useState("");
  const range = monthOf(month);
  const may = (permission: Parameters<typeof hasAccess>[1]) => membership !== null && hasAccess(membership, permission);
  const adds = may("expenses.create") && !readOnly;
  const edits = may("expenses.edit") && !readOnly;
  const category = categories.find((each) => each.id === categoryId) ?? null;
  const moveTo = (next: string) => {
    setMonth(next);
    setCategoryId("");
  };

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader
            title={UI_TEXT.nav.places.expenses}
            actions={adds && <Button label={words.add} icon={Plus} size="sm" onClick={adding.show} />}
          />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        <div className="grid max-w-6xl grid-cols-1 gap-6">
          {(may("expenses.create") || may("expenses.edit")) && <ReadOnlyNote />}
          <MonthSwitcher
            label={words.monthLabel}
            month={month}
            onPrevious={() => moveTo(addMonthsKey(month, -1))}
            onNext={() => moveTo(addMonthsKey(month, 1))}
            previousLabel={words.previousMonth}
            nextLabel={words.nextMonth}
            latest={isLatestMonth(month)}
          />
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <ExpenseTotals range={range} categoryId={categoryId} onCategory={setCategoryId} />
            <section aria-label={words.list}>
              <ExpenseList
                range={range}
                categoryId={categoryId}
                categoryName={category?.name ?? null}
                canEdit={edits}
                onOpen={opened.show}
              />
            </section>
          </div>
        </div>
      </div>
      {adds && <ExpenseSheet open={adding.open} onClose={adding.close} categories={categories} />}
      {edits && (
        <ExpenseSheet
          key={opened.item?.id}
          open={opened.open}
          onClose={opened.close}
          expense={opened.item}
          categories={categories}
        />
      )}
    </>
  );
}
