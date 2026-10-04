import type { ReactNode } from "react";

/** One fact of a record: what it is, and its value. */
export interface Detail {
  label: string;
  value: ReactNode;
}

/**
 * A record's facts, read at a glance (D113): a surface card of lines, each a
 * label and its value, hairlines between — side by side from 640 px, the label
 * over its value on a phone. The screen passes only what holds a value. A
 * value keeps the lines it was written in (an address, a note).
 */
export function DetailList({ details }: { details: readonly Detail[] }) {
  return (
    <dl className="divide-y divide-line rounded-row bg-surface px-5">
      {details.map(({ label, value }) => (
        <div key={label} className="grid gap-0.5 py-3.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="text-small font-bold text-muted">{label}</dt>
          <dd className="min-w-0 break-words whitespace-pre-line text-ink tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
