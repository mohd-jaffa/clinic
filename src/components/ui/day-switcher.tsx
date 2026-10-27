"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { addDaysKey } from "@/lib/dates/calendar";

import { IconButton } from "./button";
import { DatePicker } from "./date-picker";

/**
 * A day, and the one before or after it (plan §18; D356): "‹ 27 Oct 2026 ›",
 * the day between its arrows opening the app's calendar to jump further.
 * `max` turns the next arrow off on its day, and the calendar takes none
 * after it.
 */
export function DaySwitcher({
  label,
  day,
  onChange,
  max,
  chooseLabel,
  previousLabel,
  nextLabel,
}: {
  /** What the switcher is, for a screen reader: "Day". */
  label: string;
  day: string;
  onChange: (day: string) => void;
  max?: string;
  /** The calendar's name: "Choose a day". */
  chooseLabel: string;
  previousLabel: string;
  nextLabel: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <IconButton icon={ChevronLeft} label={previousLabel} onClick={() => onChange(addDaysKey(day, -1))} />
      <DatePicker variant="pill" label={chooseLabel} value={day} onChange={onChange} max={max} />
      <IconButton
        icon={ChevronRight}
        label={nextLabel}
        onClick={() => onChange(addDaysKey(day, 1))}
        disabled={max !== undefined && day >= max}
      />
    </div>
  );
}
