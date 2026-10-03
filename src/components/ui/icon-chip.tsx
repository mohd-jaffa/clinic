import type { LucideIcon } from "lucide-react";

/**
 * A place's or an action's icon in a round chip of ground, at the head of a
 * row in a menu — the More sheet, Settings. Decorative: the row's title says
 * what it is.
 */
export function IconChip({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-ground text-ink">
      <Icon size={20} strokeWidth={2.25} />
    </span>
  );
}
