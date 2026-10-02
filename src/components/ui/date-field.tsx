"use client";

import { forwardRef } from "react";

import { DatePicker } from "./date-picker";
import { FieldError, FieldHint, FieldLabel, useFieldIds, type FieldShell } from "./field";

/**
 * A day, as a field: the label, the control that shows the day, and the app's
 * own calendar (`DatePicker`, D65). It holds "2026-10-02", or "" for none, and
 * is controlled as the select is: a form holds it through `Controller`, and
 * `ref` reaches the control.
 */
export const DateField = forwardRef<
  HTMLButtonElement,
  FieldShell & {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    min?: string;
    max?: string;
    /** Shown while no day is chosen: "Any day" on a filter. */
    placeholder?: string;
    /** Whether the field may be emptied again. */
    clearable?: boolean;
    disabled?: boolean;
  }
>(function DateField({ label, error, required, optional, hint, ...rest }, ref) {
  const { id, errorId, hintId } = useFieldIds(error, hint);
  return (
    <div>
      <FieldLabel id={`${id}-label`} htmlFor={id} label={label} required={required} optional={optional} />
      <DatePicker
        ref={ref}
        id={id}
        label={label}
        labelledBy={`${id}-label`}
        invalid={Boolean(error)}
        describedBy={hintId ?? errorId}
        {...rest}
      />
      <FieldHint id={hintId} hint={hint} />
      <FieldError id={errorId} message={error} />
    </div>
  );
});
