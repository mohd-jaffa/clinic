"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { formatMonthYear } from "@/lib/format/date";

import { IconButton } from "./button";

/**
 * A month, and the one before or after it (plan §16; D330): "‹ October 2026
 * ›", the month named between its arrows, said as it changes. `month` is
 * its first day; `latest` turns the next arrow off — there is none after it
 * to show.
 */
export function MonthSwitcher({
  label,
  month,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  latest = false,
}: {
  /** What the switcher is, for a screen reader: "Month". */
  label: string;
  month: string;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
  latest?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <IconButton icon={ChevronLeft} label={previousLabel} onClick={onPrevious} />
      <p aria-live="polite" className="min-w-40 text-center text-title font-bold text-ink tabular-nums">
        {formatMonthYear(month)}
      </p>
      <IconButton icon={ChevronRight} label={nextLabel} onClick={onNext} disabled={latest} />
    </div>
  );
}
