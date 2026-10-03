import { CircleAlert } from "lucide-react";
import { useId } from "react";

import { UI_TEXT } from "@/constants/messages";

/**
 * The well every single-line field sits in — a capsule, as every control on
 * the map is (plan §32.1): the surface, an edge that clears 3 : 1 on the
 * ground and the surface (`edge`, WCAG 1.4.11 — a hairline alone would not
 * show where to type), and coral when there is something to put right. The
 * text field, the select and the date picker share it, so a choice looks like
 * the fields around it. A control whose role cannot say it is invalid — the
 * date picker's button — says so with `data-invalid`.
 *
 * What is typed is 17 px, never under 16, so an iPhone does not zoom in, and
 * digits are tabular, so a phone number or an amount lines up.
 */
export const FIELD_BASE =
  "w-full border border-edge bg-surface px-5 text-body text-ink tabular-nums transition-colors " +
  "aria-[invalid=true]:border-coral data-[invalid=true]:border-coral " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/** The capsule a single line is typed or chosen in; longer text takes soft corners instead. */
export const FIELD_WELL = `${FIELD_BASE} min-h-12 rounded-full py-2.5`;

/** What every field has around its control. */
export interface FieldShell {
  label: string;
  error?: string;
  /** Marks the field required, both visually and to assistive technology. */
  required?: boolean;
  /** Says "(Optional)" after the label. */
  optional?: boolean;
  hint?: string;
}

/** A hint is read with its field; an error takes its place, on screen and when read. */
export function useFieldIds(error?: string, hint?: string) {
  const id = useId();
  return {
    id,
    errorId: error ? `${id}-error` : undefined,
    hintId: hint && !error ? `${id}-hint` : undefined,
  };
}

export function FieldLabel({
  id,
  htmlFor,
  label,
  required,
  optional,
}: {
  id?: string;
  htmlFor: string;
  label: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label id={id} htmlFor={htmlFor} className="mb-1.5 block text-small font-bold text-ink">
      {label}
      {required && (
        // Muted: coral is kept for what must not be missed (plan §32.1).
        <span className="text-muted" aria-hidden="true">
          {" *"}
        </span>
      )}
      {optional && <span className="font-normal text-muted">{` ${UI_TEXT.fields.optional}`}</span>}
    </label>
  );
}

export function FieldHint({ id, hint }: { id?: string; hint?: string }) {
  return id ? (
    <p id={id} className="mt-1.5 text-small text-muted">
      {hint}
    </p>
  ) : null;
}

/**
 * A field's validation message: announced when it appears, tied to its
 * control by id so it is read with the field, and marked as well as coloured.
 */
export function FieldError({ id, message }: { id?: string; message?: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-small font-bold text-coral">
      <CircleAlert size={16} strokeWidth={2.5} aria-hidden="true" className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}
