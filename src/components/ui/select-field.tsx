"use client";

import { forwardRef } from "react";

import { FieldError, FieldHint, FieldLabel, useFieldIds, type FieldShell } from "./field";
import { SelectMenu, type SelectOption } from "./select-menu";

export type { SelectOption };

/**
 * A choice among a few, as a field: the label, the control that shows what
 * is chosen, and the app's own list (`SelectMenu`, D65). It is controlled: a
 * form holds its value through react-hook-form's `Controller`, and `ref`
 * reaches the control, so a refused field is focused.
 */
export const SelectField = forwardRef<
  HTMLButtonElement,
  FieldShell & {
    options: readonly SelectOption[];
    /** A first choice with the empty value — "All doctors". */
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    disabled?: boolean;
  }
>(function SelectField({ label, error, required, optional, hint, ...rest }, ref) {
  const { id, errorId, hintId } = useFieldIds(error, hint);
  return (
    <div>
      <FieldLabel id={`${id}-label`} htmlFor={id} label={label} required={required} optional={optional} />
      <SelectMenu
        ref={ref}
        id={id}
        label={label}
        labelledBy={`${id}-label`}
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

/** Options built from one of the constant lists and its label map (src/constants/statuses.ts). */
export function optionsFrom<T extends string>(values: readonly T[], labels: Record<T, string>): SelectOption[] {
  return values.map((value) => ({ value, label: labels[value] }));
}
