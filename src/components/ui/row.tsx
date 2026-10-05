import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "./cn";

/**
 * A list of rows on the ground (plan §32.1). `rows`: each row its own soft
 * surface, a little apart from the next — the queue's waiting patients, a
 * list of bills. `menu`: one continuous list on the ground, rows parted by
 * hairlines — Settings, My account, the More sheet (D75) — so a menu never
 * becomes a stack of cards. Each child is a `Row` of the same look.
 */
export function RowList({
  label,
  look = "rows",
  children,
}: {
  label?: string;
  look?: "rows" | "menu";
  children: ReactNode;
}) {
  return (
    // One column no wider than the list, so a long line is cut short with "…" rather than widening the page.
    <ul
      role="list"
      aria-label={label}
      className={cn("grid grid-cols-1", look === "menu" ? "divide-y divide-line border-y border-line" : "gap-2.5")}
    >
      {children}
    </ul>
  );
}

/**
 * A menu row's icon, bare on the ground — no tile under it (D75). Decorative:
 * the row's title says what it is. `attention` is coral, for a row whose
 * screen holds what cannot be undone — Delete clinic (plan §32.1).
 */
export function RowIcon({ icon: Icon, tone }: { icon: LucideIcon; tone?: "attention" }) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-11 place-items-center", tone === "attention" ? "text-coral" : "text-ink")}
    >
      <Icon size={22} strokeWidth={2.25} />
    </span>
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
 * `detail` is a value read at the row's end — a price, a length — and stays
 * part of the target. A chevron shows where the row goes when nothing else
 * is at its end.
 *
 * `look`: a `surface` row stands on the ground on its own; a `quiet` one is
 * not yet in play — still to come, done — drawn as an outline instead; a
 * `menu` row is one line of a menu's list, bare on the ground (D75).
 * `wrap` lets the line under the title run on instead of being cut short,
 * for words that must be read whole — why an import's row was left out.
 */
export function Row({
  leading,
  title,
  subtitle,
  detail,
  trailing,
  href,
  onClick,
  look = "surface",
  wrap = false,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  look?: "surface" | "quiet" | "menu";
  wrap?: boolean;
}) {
  const menu = look === "menu";
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
        "relative flex min-h-16 items-center gap-3",
        menu ? "py-2 pr-1" : "rounded-row py-2.5 pr-2 pl-3.5",
        look === "surface" && "bg-surface",
        look === "quiet" && "ring-1 ring-line ring-inset",
        goes &&
          (menu
            ? "transition-colors hover:bg-ink/5"
            : "transition-shadow hover:ring-2 hover:ring-line hover:ring-inset"),
      )}
    >
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        {target}
        {subtitle && (
          <span
            className={cn("block text-small text-muted tabular-nums", wrap ? "text-pretty break-words" : "truncate")}
          >
            {subtitle}
          </span>
        )}
      </span>
      {detail && <span className="shrink-0 font-bold text-ink tabular-nums">{detail}</span>}
      {trailing && <span className="relative z-[1] flex shrink-0 items-center gap-2">{trailing}</span>}
      {goes && <ChevronRight size={20} strokeWidth={2.25} aria-hidden="true" className="mr-1.5 shrink-0 text-muted" />}
    </li>
  );
}
