"use client";

import { Clock } from "lucide-react";
import { forwardRef } from "react";

import { UI_TEXT } from "@/constants/messages";
import { formatClock } from "@/lib/format/date";

import { FieldError, FieldHint, FieldLabel, useFieldIds, type FieldShell } from "./field";
import { SelectMenu } from "./select-menu";

/** "09:15" as minutes from midnight, and back. */
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const timeOf = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** The times offered: every `step` minutes from `from` to `to`, both included where the step lands on it. */
export function timesBetween(from: string, to: string, step: number): string[] {
  const times: string[] = [];
  for (let minutes = minutesOf(from); minutes <= minutesOf(to); minutes += step) times.push(timeOf(minutes));
  return times;
}

/**
 * A time of day, as a field: a list of the times every `step` minutes, in the
 * app's own look (D65), shown as "9:15 AM". It holds what the database's
 * `time` holds, "09:15", or "" for none. A time between the steps — one saved
 * at 9:40 — is kept, and offered in its place.
 */
export const TimeField = forwardRef<
  HTMLButtonElement,
  FieldShell & {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    /** The first and last times offered; the whole day unless the screen says otherwise. */
    from?: string;
    to?: string;
    /** Minutes between the times offered. */
    step?: number;
    disabled?: boolean;
  }
>(function TimeField(
  { label, error, required, optional, hint, value, from = "00:00", to = "23:59", step = 15, ...rest },
  ref,
) {
  const { id, errorId, hintId } = useFieldIds(error, hint);
  const offered = timesBetween(from, to, step);
  const times = !value || offered.includes(value) ? offered : [...offered, value].sort();
  return (
    <div>
      <FieldLabel id={`${id}-label`} htmlFor={id} label={label} required={required} optional={optional} />
      <SelectMenu
        ref={ref}
        id={id}
        label={label}
        labelledBy={`${id}-label`}
        value={value}
        placeholder={value ? undefined : UI_TEXT.datePicker.chooseTime}
        options={times.map((time) => ({ value: time, label: formatClock(time) }))}
        leading={<Clock size={18} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-muted" />}
        invalid={Boolean(error)}
        required={required}
        describedBy={hintId ?? errorId}
        {...rest}
      />
      <FieldHint id={hintId} hint={hint} />
      <FieldError id={errorId} message={error} />
    </div>
  );
});
