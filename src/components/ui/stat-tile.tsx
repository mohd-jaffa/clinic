import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Figures side by side, as one description list: two to a row on a phone, four from a tablet. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</dl>;
}

/**
 * One figure and what it is (plan §32.1). On the land — Home's waiting and
 * seen — the figure stands in display size straight on the field; on the
 * ground — Collected, Outstanding — it sits on a soft surface. It is a
 * label–value pair inside a `StatGrid`, read "Waiting, 4". With `href` the
 * whole figure opens where it is looked into; `note` is what needs seeing
 * beside it, in coral words: "3 overdue".
 */
export function StatTile({
  label,
  value,
  note,
  href,
  on = "ground",
}: {
  label: string;
  /** Already formatted — "₹1,240" or "7" — so the tile never decides how money reads. */
  value: string;
  note?: string;
  href?: string;
  on?: "ground" | "land";
}) {
  const land = on === "land";
  return (
    <div className={cn("relative flex min-w-0 flex-col", !land && "rounded-row bg-surface p-4")}>
      <dt className={cn("order-2 text-small", land ? "text-land-muted" : "text-muted")}>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-1 after:absolute after:inset-0 after:rounded-row focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-action"
          >
            {label}
            <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd
        className={cn(
          "order-1 truncate font-bold tracking-[-0.02em] tabular-nums",
          land ? "text-display text-land-ink" : "text-heading text-ink",
        )}
      >
        {value}
      </dd>
      {note && (
        <dd
          className={cn(
            "order-3 mt-1 text-small font-bold",
            // Coral words would not stand out from the land: there the note is a small coral capsule.
            land ? "self-start rounded-full bg-coral px-2.5 py-0.5 text-on-coral" : "text-coral",
          )}
        >
          {note}
        </dd>
      )}
    </div>
  );
}
