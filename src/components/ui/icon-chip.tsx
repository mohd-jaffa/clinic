import type { LucideIcon } from "lucide-react";

import { cn } from "./cn";

/**
 * A place's or an action's icon in a round chip of ground, at the head of a
 * row in a menu — the More sheet, Settings. Decorative: the row's title says
 * what it is. `attention` is coral, for a row whose screen holds what cannot
 * be undone — Delete clinic (plan §32.1).
 */
export function IconChip({ icon: Icon, tone }: { icon: LucideIcon; tone?: "attention" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-11 place-items-center rounded-full",
        tone === "attention" ? "bg-coral-soft text-coral" : "bg-ground text-ink",
      )}
    >
      <Icon size={20} strokeWidth={2.25} />
    </span>
  );
}
