import { CircleAlert, Info } from "lucide-react";

import { cn } from "./cn";

const TONES = {
  danger: { className: "bg-coral-soft text-ink", mark: "text-coral", icon: CircleAlert },
  info: { className: "bg-surface text-muted", mark: "text-muted", icon: Info },
} as const;

/**
 * A line the screen says on its own behalf, on the ground (plan §32.1) — most
 * often that something could not be loaded. Marked as well as tinted, and
 * announced, because it usually appears in answer to something just done.
 */
export function ScreenNotice({ children, tone = "danger" }: { children: string; tone?: keyof typeof TONES }) {
  const { className, mark, icon: Icon } = TONES[tone];
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-row p-4", className)}>
      <Icon size={20} strokeWidth={2.25} aria-hidden="true" className={cn("mt-0.5 shrink-0", mark)} />
      <p>{children}</p>
    </div>
  );
}
