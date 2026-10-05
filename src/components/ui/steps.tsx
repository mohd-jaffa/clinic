import { Check } from "lucide-react";

import { cn } from "./cn";

/**
 * Where a person is in a task of a few steps — a patient import's File,
 * Columns, Check and Import (D131): an ordered list, each step a round mark
 * and its name. A step done shows a check on `--action`; the current one is
 * the `--chip` and says so to a screen reader (`aria-current`); one still to
 * come is a ring. The words carry it, never the colour alone. On a phone
 * only the current step's name is shown, so four steps fit its width.
 */
export function Steps({ label, steps, current }: { label: string; steps: readonly string[]; current: number }) {
  return (
    <ol aria-label={label} className="flex items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const now = index === current;
        return (
          <li
            key={step}
            aria-current={now ? "step" : undefined}
            className={cn("flex min-w-0 items-center gap-2", index < steps.length - 1 && "flex-1")}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-small font-bold tabular-nums",
                done && "bg-action text-on-action",
                now && "bg-chip text-on-chip",
                !done && !now && "text-muted ring-1 ring-line ring-inset",
              )}
            >
              {done ? <Check size={16} strokeWidth={2.75} /> : index + 1}
            </span>
            {/* On a phone only the current step is named on screen; every name is read out. */}
            <span
              className={cn("truncate text-small", now ? "font-bold text-ink" : "sr-only text-muted sm:not-sr-only")}
            >
              {step}
            </span>
            {index < steps.length - 1 && <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-line" />}
          </li>
        );
      })}
    </ol>
  );
}
