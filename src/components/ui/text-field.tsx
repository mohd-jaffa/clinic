"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

import { cn } from "./cn";
import { FIELD_BASE, FIELD_WELL, FieldError, FieldHint, FieldLabel, useFieldIds, type FieldShell } from "./field";

/**
 * Typed text, as one set: the label, the control and its message wired
 * together once, so react-hook-form's `register()` spreads straight onto them
 * and no screen restyles a field (plan §32.2).
 */
const TYPED =
  "text-ellipsis placeholder:text-muted " +
  // Shown but not edited — a mobile that cannot change here — reads quieter.
  "read-only:cursor-default read-only:border-line read-only:text-muted";

export type TextFieldProps = FieldShell & {
  /** A control inside the field, at its end — the reveal button on a password. */
  trailing?: ReactNode;
  /** A mark inside the field before the text — an icon naming the field. */
  leading?: ReactNode;
  /** Fixed text before what is typed — "+91", "₹". Read out with the field. */
  prefix?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "prefix">;

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, required, optional, hint, trailing, leading, prefix, ...rest },
  ref,
) {
  const { id, errorId, hintId } = useFieldIds(error, hint);
  const prefixId = prefix ? `${id}-prefix` : undefined;
  const describedBy = [prefixId, hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} required={required} optional={optional} />
      <div className="relative">
        {leading && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-muted"
          >
            {leading}
          </span>
        )}
        {prefix && (
          <span
            id={prefixId}
            className={cn(
              "pointer-events-none absolute inset-y-2.5 flex items-center border-r border-line pr-3 text-body font-bold text-ink",
              leading ? "left-12" : "left-5",
            )}
          >
            {prefix}
          </span>
        )}
        <input
          id={id}
          ref={ref}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            FIELD_WELL,
            TYPED,
            Boolean(leading) && "pl-12",
            Boolean(prefix) && (leading ? "pl-[6.25rem]" : "pl-[4.25rem]"),
            Boolean(trailing) && "pr-14",
          )}
          {...rest}
        />
        {trailing && <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
      </div>
      <FieldHint id={hintId} hint={hint} />
      <FieldError id={errorId} message={error} />
    </div>
  );
});

/** Longer text — a note, an address — in a well with soft corners rather than a capsule. */
export const TextAreaField = forwardRef<
  HTMLTextAreaElement,
  FieldShell & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id">
>(function TextAreaField({ label, error, required, optional, hint, rows = 3, ...rest }, ref) {
  const { id, errorId, hintId } = useFieldIds(error, hint);
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} required={required} optional={optional} />
      <textarea
        id={id}
        ref={ref}
        rows={rows}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={hintId ?? errorId}
        className={cn(FIELD_BASE, TYPED, "min-h-24 rounded-row py-3")}
        {...rest}
      />
      <FieldHint id={hintId} hint={hint} />
      <FieldError id={errorId} message={error} />
    </div>
  );
});
