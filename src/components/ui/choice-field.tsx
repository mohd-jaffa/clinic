"use client";

import { ChoiceChips } from "./choice-chips";
import { FieldError, FieldHint, useFieldIds, type FieldShell } from "./field";

/**
 * A choice among a few, as a field (plan §32.2): its label, a row of capsules
 * — a patient's gender — and the field's hint or refusal beside it. Nothing
 * is chosen while `value` is none of the options.
 */
export function ChoiceField<T extends string>({
  label,
  error,
  required,
  hint,
  value,
  options,
  onChange,
}: Omit<FieldShell, "optional"> & {
  value: T | "";
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { id, errorId, hintId } = useFieldIds(error, hint);
  return (
    <div>
      <p id={`${id}-label`} className="mb-1.5 text-small font-bold text-ink">
        {label}
        {required && (
          <span className="text-muted" aria-hidden="true">
            {" *"}
          </span>
        )}
      </p>
      <ChoiceChips
        label={label}
        labelledBy={`${id}-label`}
        describedBy={hintId ?? errorId}
        value={value as T}
        options={options}
        onChange={onChange}
        wrap
      />
      <FieldHint id={hintId} hint={hint} />
      <FieldError id={errorId} message={error} />
    </div>
  );
}
