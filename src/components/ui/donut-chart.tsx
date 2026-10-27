import { useId } from "react";

import { cn } from "./cn";

/** The colours a part may take: the app's own, each told apart from its neighbours (D355). */
export type DonutTone = "action" | "ink" | "coral" | "edge";

const STROKES: Record<DonutTone, string> = {
  action: "stroke-action",
  ink: "stroke-ink",
  coral: "stroke-coral",
  edge: "stroke-edge",
};
const SWATCHES: Record<DonutTone, string> = {
  action: "bg-action",
  ink: "bg-ink",
  coral: "bg-coral",
  edge: "bg-edge",
};

/** One part of the whole: its name, how many, and its colour. */
export interface DonutPart {
  key: string;
  label: string;
  value: number;
  tone: DonutTone;
}

const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** The surface's gap between two parts, in the drawing's units. */
const GAP = 2;

/**
 * A whole and its few parts, at a glance (plan §18; D66, D355): a ring from
 * the top, clockwise, in the parts' order, each parted from the next by a
 * gap of the surface; the whole in its middle. The legend names every part
 * with its count and share — the same values in words, so colour never
 * carries one alone and nothing waits behind a hover. A part with none is
 * left out of the ring and kept in the legend; with nothing at all the ring
 * gives way to `empty`.
 */
export function DonutChart({
  title,
  parts,
  total,
  empty,
  share,
}: {
  title: string;
  parts: readonly DonutPart[];
  /** The whole, in its middle: "48 appointments". */
  total: (count: number) => string;
  empty: string;
  /** A part's count and share: "12 · 25%". */
  share: (count: number, percent: number) => string;
}) {
  const titleId = useId();
  const sum = parts.reduce((all, part) => all + part.value, 0);
  const drawn = parts.filter((part) => part.value > 0);
  const lengths = drawn.map((part) => (part.value / sum) * CIRCUMFERENCE);
  // Where each part starts round the ring: after every part before it.
  const starts = lengths.map((_, index) => lengths.slice(0, index).reduce((all, length) => all + length, 0));

  return (
    <figure aria-labelledby={titleId} className="grid min-w-0 gap-3">
      <figcaption id={titleId} className="text-title font-bold text-ink">
        {title}
      </figcaption>
      {sum === 0 ? (
        <p className="text-small text-muted">{empty}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative size-40 shrink-0">
            <svg aria-hidden="true" viewBox="0 0 120 120" className="size-full -rotate-90">
              {drawn.map((part, index) => {
                // A lone part is the whole ring; otherwise each gives up its gap.
                const painted = drawn.length === 1 ? lengths[index] : Math.max(0, lengths[index] - GAP);
                return (
                  <circle
                    key={part.key}
                    data-part={part.key}
                    cx="60"
                    cy="60"
                    r={RADIUS}
                    fill="none"
                    strokeWidth="16"
                    strokeDasharray={`${painted} ${CIRCUMFERENCE - painted}`}
                    strokeDashoffset={-starts[index]}
                    className={STROKES[part.tone]}
                  />
                );
              })}
            </svg>
            <p className="absolute inset-0 grid place-items-center px-6 text-center text-small text-muted">
              {total(sum)}
            </p>
          </div>
          <ul aria-label={title} className="grid min-w-48 flex-1 gap-2">
            {parts.map((part) => (
              <li key={part.key} className="flex items-center gap-3 text-small text-ink">
                <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-full", SWATCHES[part.tone])} />
                <span className="flex-1">{part.label}</span>
                <span className="font-bold tabular-nums">
                  {share(part.value, Math.round((part.value / sum) * 100))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
