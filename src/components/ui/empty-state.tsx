import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * What a list shows when it has nothing in it (plan §32.1): a small lobe of
 * land with its mark, a warm line saying what is missing, why it is worth
 * having, and the one action that starts it.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <span aria-hidden="true" className="mb-5 grid size-20 place-items-center rounded-lobe bg-land text-land-ink">
        <Icon size={30} strokeWidth={2} />
      </span>
      <h2 className="text-title font-bold text-ink">{title}</h2>
      {hint && <p className="mt-1.5 max-w-sm text-muted">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
