"use client";

import { useArrowSelection } from "@/hooks/useArrowSelection";

import { cn } from "./cn";

/**
 * A choice between a few named views — System, Light, Dark; Day and Week — as
 * a capsule whose ink chip travels to the choice (plan §32.1). A real
 * radiogroup: Tab reaches the chosen one, and the arrow keys move the choice
 * (AGENTS.md §23). The options share the width equally, so one chip's width
 * is one step, and the glide is a transform on the map's one curve.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const keys = useArrowSelection(
    options.map((option) => option.value),
    value,
    onChange,
  );
  const chosen = options.findIndex((option) => option.value === value);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={keys.onKeyDown}
      className="relative flex rounded-full bg-surface p-1 ring-1 ring-inset ring-line"
    >
      {chosen >= 0 && (
        <span
          aria-hidden="true"
          data-chip=""
          className="absolute inset-y-1 left-1 rounded-full bg-chip transition-transform duration-(--duration-map) ease-map"
          style={{
            width: `calc((100% - 0.5rem) / ${options.length})`,
            transform: `translateX(${chosen * 100}%)`,
          }}
        />
      )}
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
              "relative min-h-11 flex-1 rounded-full px-4 text-small font-bold whitespace-nowrap transition-colors duration-(--duration-map) ease-map",
              selected ? "text-on-chip" : "text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
