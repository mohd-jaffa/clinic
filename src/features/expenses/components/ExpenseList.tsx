"use client";

import { Archive, RotateCcw, Wallet } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { Row, RowList } from "@/components/ui/row";
import { UI_TEXT } from "@/constants/messages";
import { PAYMENT_METHOD_LABELS } from "@/constants/statuses";
import { todayKey } from "@/lib/dates/calendar";
import { byDay } from "@/lib/dates/group";
import type { DayRange } from "@/lib/dates/range";
import { formatPaise } from "@/lib/format/currency";
import { formatNearDate } from "@/lib/format/date";

import { useArchiveExpense } from "../hooks/useArchiveExpense";
import { useExpenses } from "../hooks/useExpenses";
import type { Expense } from "../types";

const { expenses: words } = UI_TEXT;

/** A day's heading (D332): "Today", "14 Oct" — the year when it is not this one. */
const dayName = (day: string) => (day === todayKey() ? words.today : formatNearDate(day));

/** Its line: what it was for, if said, and how it was paid. */
const lineOf = (expense: Expense) =>
  [expense.description, PAYMENT_METHOD_LABELS[expense.method]].filter(Boolean).join(" · ");

/**
 * A month's expenses (plan §16; D330 – D332, D344): grouped by day, newest
 * first — "Today", "14 Oct" — each row its category, what it was for and how
 * it was paid, and its amount; one category's alone when one is picked. For
 * whoever may correct them a row opens its sheet; for anyone else it shows
 * all there is. **Show archived** under it lists the month's archived ones,
 * with **Restore** for whoever may.
 */
export function ExpenseList({
  range,
  categoryId,
  categoryName,
  canEdit,
  onOpen,
}: {
  range: DayRange;
  categoryId: string;
  /** The category picked, named in the empty state. */
  categoryName: string | null;
  canEdit: boolean;
  onOpen: (expense: Expense) => void;
}) {
  const query = useExpenses(range, { categoryId: categoryId || undefined });
  const [showArchived, setShowArchived] = useState(false);
  return (
    <div className="grid gap-6">
      <ListScreen
        query={query}
        loadFailed="EXPENSES_LOAD_FAILED"
        data={query.data}
        empty={
          <EmptyState
            icon={Wallet}
            title={categoryName ? words.noneOf(categoryName) : words.empty}
            hint={words.emptyHint}
          />
        }
        renderList={(expenses) => (
          <div className="grid gap-5">
            {byDay(expenses, (expense) => expense.day).map(({ day, rows: ofDay }) => (
              <DayExpenses key={day} day={day} expenses={ofDay} canEdit={canEdit} onOpen={onOpen} />
            ))}
          </div>
        )}
      />
      <Disclosure
        label={words.showArchived}
        showLabel={words.showArchived}
        hideLabel={words.hideArchived}
        icon={Archive}
        shown={showArchived}
        onShownChange={setShowArchived}
      >
        <ArchivedExpenses range={range} categoryId={categoryId} shown={showArchived} canEdit={canEdit} />
      </Disclosure>
    </div>
  );
}

/** One day's expenses, under its name. */
function DayExpenses({
  day,
  expenses,
  canEdit,
  onOpen,
}: {
  day: string;
  expenses: readonly Expense[];
  canEdit: boolean;
  onOpen: (expense: Expense) => void;
}) {
  const headingId = useId();
  const name = dayName(day);
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-2 text-small font-bold text-muted">
        {name}
      </h3>
      <RowList label={name}>
        {expenses.map((expense) => (
          <Row
            key={expense.id}
            title={expense.category.name}
            subtitle={lineOf(expense)}
            detail={<span className="font-bold text-ink tabular-nums">{formatPaise(expense.amountPaise)}</span>}
            {...(canEdit && { onClick: () => onOpen(expense) })}
          />
        ))}
      </RowList>
    </section>
  );
}

/** The month's archived expenses (D331), read once shown, each with Restore for whoever may. */
function ArchivedExpenses({
  range,
  categoryId,
  shown,
  canEdit,
}: {
  range: DayRange;
  categoryId: string;
  shown: boolean;
  canEdit: boolean;
}) {
  const query = useExpenses(range, { categoryId: categoryId || undefined, archived: true, enabled: shown });
  const { restore, restoring } = useArchiveExpense();
  return (
    <ListScreen
      query={query}
      loadFailed="EXPENSES_LOAD_FAILED"
      data={query.data}
      empty={<p className="text-small text-muted">{words.archivedEmpty}</p>}
      renderList={(expenses) => (
        <RowList label={words.showArchived}>
          {expenses.map((expense) => (
            <Row
              key={expense.id}
              look="quiet"
              title={expense.category.name}
              subtitle={[dayName(expense.day), lineOf(expense)].join(" · ")}
              detail={<span className="font-bold text-ink tabular-nums">{formatPaise(expense.amountPaise)}</span>}
              trailing={
                canEdit && (
                  <Button
                    label={UI_TEXT.actions.restore}
                    aria-label={words.restoreOf(formatPaise(expense.amountPaise), expense.category.name)}
                    icon={RotateCcw}
                    variant="secondary"
                    size="sm"
                    loading={restoring === expense.id}
                    onClick={() => void restore(expense)}
                  />
                )
              }
            />
          ))}
        </RowList>
      )}
    />
  );
}
