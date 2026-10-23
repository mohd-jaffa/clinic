"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { LoadFailed } from "@/components/ui/list-screen";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import type { DayRange } from "@/lib/dates/range";
import { formatPaise } from "@/lib/format/currency";
import { formatMonthYear } from "@/lib/format/date";

import { useExpenseTotals } from "../hooks/useExpenseTotals";

const { expenses: words } = UI_TEXT;

/**
 * A month's totals (plan §16; D330, D331): what was spent in it, in display
 * numerals, then each category's total, by the clinic's own order —
 * archived expenses left out. A category tapped keeps the list to its
 * expenses, and tapped again — or **Show all** — shows every one.
 */
export function ExpenseTotals({
  range,
  categoryId,
  onCategory,
}: {
  range: DayRange;
  /** The category the list keeps to; none for every one. */
  categoryId: string;
  onCategory: (categoryId: string) => void;
}) {
  const query = useExpenseTotals(range);
  const headingId = useId();
  const totals = query.data;

  if (totals === undefined) {
    return query.error != null ? (
      <LoadFailed query={query} loadFailed="EXPENSE_TOTALS_LOAD_FAILED" />
    ) : (
      <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
        <SkeletonRows rows={2} />
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-5">
      <div>
        <p id={headingId} className="text-small font-bold text-muted">
          {words.spentIn(formatMonthYear(range.from))}
        </p>
        <p className="text-display font-bold text-ink tabular-nums">{formatPaise(totals.totalPaise)}</p>
      </div>
      {totals.categories.length > 0 && (
        <div>
          <SectionHeading id={`${headingId}-by`} title={words.byCategory}>
            {categoryId && <Button label={words.showAll} variant="quiet" size="sm" onClick={() => onCategory("")} />}
          </SectionHeading>
          <ul aria-labelledby={`${headingId}-by`} className="grid gap-2">
            {totals.categories.map((category) => {
              const chosen = category.id === categoryId;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    aria-pressed={chosen}
                    aria-label={`${words.onlyOf(category.name)}: ${formatPaise(category.totalPaise)}`}
                    onClick={() => onCategory(chosen ? "" : category.id)}
                    className={cn(
                      "flex min-h-12 w-full items-center justify-between gap-3 rounded-row px-4 py-2.5 text-left",
                      "transition-colors duration-(--duration-map) ease-map",
                      chosen
                        ? "bg-land text-land-ink"
                        : "bg-surface text-ink hover:ring-2 hover:ring-line hover:ring-inset",
                    )}
                  >
                    <span className="min-w-0 truncate font-bold">{category.name}</span>
                    <span className="shrink-0 font-bold tabular-nums">{formatPaise(category.totalPaise)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
