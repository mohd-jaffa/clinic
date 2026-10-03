"use client";

import { useArrowSelection } from "@/hooks/useArrowSelection";

import { cn } from "./cn";

/** Chosen and not, on the ground and on the land (where the queue switches doctors). */
const ON = {
  ground: {
    chosen: "bg-chip text-on-chip",
    other: "bg-surface text-ink ring-1 ring-inset ring-line hover:ring-edge",
  },
  land: {
    chosen: "bg-land-ink text-land",
    other: "text-land-ink ring-2 ring-inset ring-land-ink hover:bg-land-ink/10",
  },
} as const;

/**
 * One choice from a row of capsules — a doctor, a follow-up's tab, a payment
 * method. One is chosen at a time, so it is a radiogroup with the arrow-key
 * movement, and the row scrolls sideways rather than wrapping when there are
 * many. `wrap` lays a short set over lines instead, where every choice must be
 * seen.
 */
export function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
  wrap = false,
  on = "ground",
  labelledBy,
  describedBy,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  wrap?: boolean;
  on?: keyof typeof ON;
  /** A visible label that names the group, in place of `label`. */
  labelledBy?: string;
  /** A hint or a refusal beside the group. */
  describedBy?: string;
}) {
  const keys = useArrowSelection(
    options.map((option) => option.value),
    value,
    onChange,
  );
  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onKeyDown={keys.onKeyDown}
      className={cn(
        "flex gap-2 py-1",
        wrap ? "flex-wrap" : "-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0",
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={keys.register(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={keys.tabIndex(option.value)}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-11 shrink-0 rounded-full px-4 text-small font-bold whitespace-nowrap transition-colors duration-(--duration-map) ease-map",
              selected ? ON[on].chosen : ON[on].other,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
