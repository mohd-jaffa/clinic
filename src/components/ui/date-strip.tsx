"use client";

import { useEffect, useRef } from "react";

import { UI_TEXT } from "@/constants/messages";
import { useArrowSelection } from "@/hooks/useArrowSelection";
import { todayKey } from "@/lib/dates/calendar";
import { formatLongDate } from "@/lib/format/date";

import { cn } from "./cn";

/** Monday first, as the clinic's weeks are. */
const weekdayOf = (day: string) => UI_TEXT.datePicker.weekdaysAbbr[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7];

/**
 * A row of days to pick one from — the appointments' day, the queue's
 * (plan §32.2): each a tall capsule with its weekday and date, the chosen one
 * an ink chip and today ringed in green. A radiogroup with the arrow-key
 * movement; the row scrolls sideways and keeps the chosen day in view.
 */
export function DateStrip({
  label,
  value,
  days,
  onChange,
}: {
  label: string;
  value: string;
  /** The days offered, as keys, in order — the screen decides how far it reaches. */
  days: readonly string[];
  onChange: (day: string) => void;
}) {
  const keys = useArrowSelection(days, value, onChange);
  const row = useRef<HTMLDivElement>(null);
  const today = todayKey();

  useEffect(() => {
    row.current
      ?.querySelector<HTMLElement>('[aria-checked="true"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [value]);

  return (
    <div
      ref={row}
      role="radiogroup"
      aria-label={label}
      onKeyDown={keys.onKeyDown}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:px-0"
    >
      {days.map((day) => {
        const selected = day === value;
        const isToday = day === today;
        return (
          <button
            key={day}
            ref={keys.register(day)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={formatLongDate(day)}
            aria-current={isToday ? "date" : undefined}
            tabIndex={keys.tabIndex(day)}
            onClick={() => onChange(day)}
            className={cn(
              "flex min-h-16 w-13 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full py-2 transition-colors duration-(--duration-map) ease-map",
              selected
                ? "bg-chip text-on-chip"
                : isToday
                  ? "bg-surface text-ink ring-2 ring-action ring-inset"
                  : "bg-surface text-ink ring-1 ring-line ring-inset",
            )}
          >
            <span className={cn("text-caption", !selected && "text-muted")}>{weekdayOf(day)}</span>
            <span className="text-title font-bold tabular-nums">{Number(day.slice(8))}</span>
          </button>
        );
      })}
    </div>
  );
}
