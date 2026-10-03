"use client";

import { useId } from "react";

import { CHECK_ROW, CheckBox } from "./checkbox";
import { FieldError, FieldHint } from "./field";

export interface CheckboxOption<T extends string> {
  value: T;
  label: string;
  /** A line under the label — what granting this lets a member do. */
  hint?: string;
  /** Shown but not changeable — a permission another one needs. */
  disabled?: boolean;
}

/**
 * Several things, each on or off — the permissions granted to a member
 * (plan §8.1). A fieldset named by its legend, each choice a native checkbox
 * drawn in the map's look with a 44 px row to tap, its hint read with it.
 */
export function CheckboxGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
  error,
}: {
  label: string;
  options: readonly CheckboxOption<T>[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const toggle = (option: T, on: boolean) =>
    onChange(on ? [...value, option] : value.filter((chosen) => chosen !== option));

  return (
    <fieldset aria-describedby={hintId ?? errorId} aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 text-small font-bold text-ink">{label}</legend>
      <div className="grid gap-1">
        {options.map((option) => {
          const optionLabel = `${id}-${option.value}-label`;
          const optionHint = option.hint ? `${id}-${option.value}-hint` : undefined;
          return (
            <label key={option.value} className={CHECK_ROW}>
              <CheckBox
                checked={value.includes(option.value)}
                disabled={option.disabled}
                // Named by its label alone; the hint is its description, not part of its name.
                aria-labelledby={optionLabel}
                aria-describedby={optionHint}
                onChange={(event) => toggle(option.value, event.target.checked)}
              />
              <span className="min-w-0">
                <span id={optionLabel} className="block font-bold text-ink">
                  {option.label}
                </span>
                {option.hint && (
                  <span id={optionHint} className="block text-small text-muted">
                    {option.hint}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <FieldHint id={hintId} hint={hint} />
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
