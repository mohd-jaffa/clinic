import type { StatusTone } from "@/constants/statuses";

import { cn } from "./cn";

const TONES: Record<StatusTone, string> = {
  neutral: "bg-ground text-muted ring-1 ring-inset ring-line",
  live: "bg-action-soft text-action",
  attention: "bg-coral-soft text-coral",
};

/**
 * Where something stands — a member's status, a plan's state — as a small
 * capsule with a dot. The tone comes from the maps in src/constants/statuses.ts,
 * so the same status cannot be green on one screen and grey on another. The
 * word carries the meaning; the colour only repeats it (plan §32.2).
 */
export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-bold",
        TONES[tone],
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
