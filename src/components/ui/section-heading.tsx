import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Where the whole list is — another screen, or another view of this one. */
export type ViewAll = { label: string; name?: string } & ({ href: string } | { onClick: () => void });

const VIEW_ALL =
  "inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-small font-bold text-action transition-colors hover:bg-action-soft";

/**
 * The title over a part of a screen, on the ground — "Waiting 4", "To bill" —
 * with how many it holds beside it, and **View all** or another control at
 * its end. The heading names its section: give the section
 * `aria-labelledby={id}`.
 */
export function SectionHeading({
  id,
  title,
  count,
  viewAll,
  children,
}: {
  id: string;
  title: string;
  /** How many the section holds, read with its title: "Waiting 4". */
  count?: number;
  /**
   * Where the whole list is. `name` is its words for a screen reader when the
   * label alone is not enough: "View all follow-ups".
   */
  viewAll?: ViewAll;
  /** Controls beside the title, before View all. */
  children?: ReactNode;
}) {
  const arrow = <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />;
  return (
    // As tall as the View all target whether or not it has one, so headings side by side line up.
    <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
      <h2 id={id} className="flex items-baseline gap-2 text-title font-bold text-ink">
        {title}
        {count !== undefined && <span className="font-normal text-muted tabular-nums">{count}</span>}
      </h2>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        {viewAll &&
          ("href" in viewAll ? (
            <Link href={viewAll.href} aria-label={viewAll.name} className={VIEW_ALL}>
              {viewAll.label}
              {arrow}
            </Link>
          ) : (
            <button type="button" onClick={viewAll.onClick} aria-label={viewAll.name} className={VIEW_ALL}>
              {viewAll.label}
              {arrow}
            </button>
          ))}
      </div>
    </div>
  );
}
