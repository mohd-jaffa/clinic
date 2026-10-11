"use client";

import { forwardRef } from "react";

import { UI_TEXT } from "@/constants/messages";
import { formatHour } from "@/lib/format/date";

import { FieldError, FieldHint, useFieldIds, type FieldShell } from "./field";
import { SelectMenu } from "./select-menu";

/** A time as its two halves, each "" until chosen: { hour: "10", minute: "30" }. */
export interface ClockValue {
  hour: string;
  minute: string;
}

const { datePicker } = UI_TEXT;

/**
 * A time of day chosen in two short lists side by side (D146): the hour,
 * "12 AM" to "11 PM", and the minutes on the screen's steps, ":00" to ":55" —
 * two taps where one long list of times would scroll. Each half is its own
 * select-only combobox, named by the field and by what it holds; `ref`
 * reaches the hour, so a refused field is focused there.
 */
export const ClockField = forwardRef<
  HTMLButtonElement,
  FieldShell & {
    value: ClockValue;
    onChange: (value: ClockValue) => void;
    /** "00" – "23", as many as the screen offers. */
    hours: readonly string[];
    /** "00" – "55", on the screen's steps. */
    minutes: readonly string[];
    /** The hour the list opens on while none is chosen. */
    opensAt?: string;
    /** What each half holds, read after the field's name: "Hour", "Minutes". */
    hourLabel: string;
    minuteLabel: string;
    disabled?: boolean;
  }
>(function ClockField(
  {
    label,
    error,
    required,
    optional,
    hint,
    value,
    onChange,
    hours,
    minutes,
    opensAt,
    hourLabel,
    minuteLabel,
    disabled,
  },
  ref,
) {
  const { id, errorId, hintId } = useFieldIds(error, hint);
  const describedBy = hintId ?? errorId;
  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="mb-1.5 text-small font-bold text-ink">
        {label}
        {required && (
          <span className="text-muted" aria-hidden="true">
            {" *"}
          </span>
        )}
        {optional && <span className="font-normal text-muted">{` ${UI_TEXT.fields.optional}`}</span>}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <SelectMenu
          ref={ref}
          label={`${label}, ${hourLabel}`}
          value={value.hour}
          placeholder={value.hour ? undefined : datePicker.chooseHour}
          options={hours.map((hour) => ({ value: hour, label: formatHour(hour) }))}
          opensAt={opensAt}
          onChange={(hour) => onChange({ ...value, hour })}
          invalid={Boolean(error)}
          required={required}
          describedBy={describedBy}
          disabled={disabled}
        />
        <SelectMenu
          label={`${label}, ${minuteLabel}`}
          value={value.minute}
          placeholder={value.minute ? undefined : datePicker.chooseMinute}
          options={minutes.map((minute) => ({ value: minute, label: datePicker.minuteOf(minute) }))}
          onChange={(minute) => onChange({ ...value, minute })}
          invalid={Boolean(error)}
          required={required}
          describedBy={describedBy}
          disabled={disabled}
        />
      </div>
      <FieldHint id={hintId} hint={hint} />
      <FieldError id={errorId} message={error} />
    </div>
  );
});
