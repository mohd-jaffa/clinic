import { Info, TriangleAlert } from "lucide-react";

import { cn } from "./cn";

const TONES = {
  danger: { className: "bg-coral-soft text-coral", icon: TriangleAlert },
  note: { className: "bg-ground text-ink ring-1 ring-inset ring-line", icon: Info },
} as const;

/**
 * One of a patient's alerts where the patient is listed — "Allergy:
 * Penicillin", "Diabetic". An allergy is in the danger tone, with a warning
 * mark; any other alert is a quiet note (plan §10.3). The words carry it, the
 * mark and the colour repeat it.
 */
export function AlertChip({
  label,
  kind,
  tone = "note",
}: {
  label: string;
  /** What the alert is — "Allergy" — said before its label to a screen reader; the mark carries it to the eye. */
  kind?: string;
  tone?: keyof typeof TONES;
}) {
  const { className, icon: Icon } = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-small font-bold",
        className,
      )}
    >
      <Icon size={16} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
      <span className="truncate">
        {kind && <span className="sr-only">{`${kind}: `}</span>}
        {label}
      </span>
    </span>
  );
}
