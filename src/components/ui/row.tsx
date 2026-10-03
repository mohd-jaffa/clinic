import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "./cn";

/**
 * A list of rows on the ground (plan §32.1): each row its own soft surface,
 * a little apart from the next — the queue's waiting patients, a list of
 * bills. Each child is a `Row`.
 */
export function RowList({ label, children }: { label?: string; children: ReactNode }) {
  return (
    // One column no wider than the list, so a long line is cut short with "…" rather than widening the page.
    <ul role="list" aria-label={label} className="grid grid-cols-1 gap-2.5">
      {children}
    </ul>
  );
}

/** A row's lead in display numerals — a token, "08", or a booked time — read with what it is. */
export function RowToken({ value, label }: { value: string; label?: string }) {
  return (
    <span className="block min-w-10 text-token font-bold tracking-[-0.02em] tabular-nums">
      {label && <span className="sr-only">{`${label} `}</span>}
      {value}
    </span>
  );
}

/**
 * One line of a list: a lead (a token, an avatar), a title with a line under
 * it, and what it leads to. With `href` or `onClick` the whole row is the
 * target — its title stretched over it — and `trailing` sits above that
 * target, so a row can open a patient and still carry its own **Send in**.
 * A chevron shows where the row goes when nothing else is at its end.
 *
 * `quiet` is a row not yet in play — still to come, done — drawn as an
 * outline on the ground rather than a surface.
 */
export function Row({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  quiet = false,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  quiet?: boolean;
}) {
  const stretched =
    "text-left after:absolute after:inset-0 after:rounded-row focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-action";
  const name = <span className="block truncate font-bold text-ink">{title}</span>;
  const target = href ? (
    <Link href={href} onClick={onClick} className={stretched}>
      {name}
    </Link>
  ) : onClick ? (
    <button type="button" onClick={onClick} className={cn("block w-full", stretched)}>
      {name}
    </button>
  ) : (
    name
  );
  const goes = (href !== undefined || onClick !== undefined) && !trailing;

  return (
    <li
      className={cn(
        "relative flex min-h-16 items-center gap-3 rounded-row py-2.5 pr-2 pl-3.5",
        quiet ? "ring-1 ring-line ring-inset" : "bg-surface",
        goes && "transition-shadow hover:ring-2 hover:ring-line hover:ring-inset",
      )}
    >
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        {target}
        {subtitle && <span className="block truncate text-small text-muted tabular-nums">{subtitle}</span>}
      </span>
      {trailing && <span className="relative z-[1] flex shrink-0 items-center gap-2">{trailing}</span>}
      {goes && <ChevronRight size={20} strokeWidth={2.25} aria-hidden="true" className="mr-1.5 shrink-0 text-muted" />}
    </li>
  );
}
