"use client";

import { Check } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes } from "react";

/** A choice's row: a 44 px target, tinted under the pointer, quieter when it cannot change. */
export const CHECK_ROW =
  "flex min-h-11 cursor-pointer items-start gap-3 rounded-row px-3 py-2.5 transition-colors hover:bg-ground has-disabled:cursor-not-allowed has-disabled:opacity-60 has-disabled:hover:bg-transparent";

type BoxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

/** The box itself: a native checkbox drawn in the map's look, its tick over it once checked. */
export const CheckBox = forwardRef<HTMLInputElement, BoxProps>(function CheckBox(props, ref) {
  return (
    <span className="relative mt-0.5 grid size-6 shrink-0 place-items-center">
      <input
        ref={ref}
        type="checkbox"
        className="peer size-6 cursor-[inherit] appearance-none rounded-md border-2 border-edge bg-surface transition-colors checked:border-action checked:bg-action"
        {...props}
      />
      <Check
        size={16}
        strokeWidth={3}
        aria-hidden="true"
        className="pointer-events-none absolute text-on-action opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
});

/**
 * One thing, on or off, on its own — "I also see patients" (plan §5.1): the
 * box, its label and a line under it, the whole row to tap. It takes
 * react-hook-form's `register()` as a text field does.
 */
export const Checkbox = forwardRef<HTMLInputElement, { label: string; hint?: string } & Omit<BoxProps, "id">>(
  function Checkbox({ label, hint, ...rest }, ref) {
    const id = useId();
    const hintId = hint ? `${id}-hint` : undefined;
    return (
      <label className={CHECK_ROW}>
        <CheckBox ref={ref} aria-labelledby={`${id}-label`} aria-describedby={hintId} {...rest} />
        <span className="min-w-0">
          <span id={`${id}-label`} className="block font-bold text-ink">
            {label}
          </span>
          {hint && (
            <span id={hintId} className="block text-small text-muted">
              {hint}
            </span>
          )}
        </span>
      </label>
    );
  },
);
