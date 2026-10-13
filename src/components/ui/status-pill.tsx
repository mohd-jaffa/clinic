import type { LucideIcon } from "lucide-react";

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
 * A tag that is not a status — Urgent — carries its own mark, `icon`, in
 * place of the dot.
 */
export function StatusPill({
  label,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  tone?: StatusTone;
  icon?: LucideIcon;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-bold",
        TONES[tone],
      )}
    >
      {Icon ? (
        <Icon size={14} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />
      ) : (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}
