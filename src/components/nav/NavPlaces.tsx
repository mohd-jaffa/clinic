"use client";

import Link from "next/link";

import { cn } from "@/components/ui/cn";
import { UI_TEXT } from "@/constants/messages";
import type { NavItem } from "@/constants/navigation";

/**
 * A place in the frame's navigation (plan §31.1), as the app and the
 * developer console both draw it: in the phone's bottom bar, the tablet's
 * rail and the desktop's sidebar.
 */
type Place = Pick<NavItem, "href" | "label" | "icon">;

export const BAR_PLACE = "flex h-full w-full flex-col items-center justify-center gap-1 text-tab";

/** One place in the bottom bar: its icon over its name, on a patch of land while current. */
export function BarPlace({ item, active, count = 0 }: { item: Place; active: boolean; count?: number }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={namedWith(item.label, count)}
      className={BAR_PLACE}
    >
      <BarMark icon={item.icon} label={item.label} active={active} count={count} />
    </Link>
  );
}

export function BarMark({
  icon: Icon,
  label,
  active,
  count = 0,
}: {
  icon: NavItem["icon"];
  label: string;
  active: boolean;
  count?: number;
}) {
  return (
    <>
      <span
        className={cn(
          "relative grid h-8 w-14 place-items-center rounded-full transition-colors duration-(--duration-map) ease-map",
          active ? "bg-land text-land-ink" : "text-muted",
        )}
      >
        <Icon size={22} strokeWidth={2.25} aria-hidden="true" />
        <PlaceCount count={count} />
      </span>
      <span className={cn("max-w-full truncate px-1", active ? "font-bold text-ink" : "text-muted")}>{label}</span>
    </>
  );
}

/** The most a place's count shows; more reads "99+". */
const MOST_SHOWN = 99;

const COUNT = "place-items-center rounded-full bg-coral font-bold text-on-coral tabular-nums";

/**
 * How many wait at a place (D337), in coral: on its icon's corner in the bar
 * and the rail, at the end of its capsule in the sidebar (`end`). A screen
 * reader hears it in the place's name (`namedWith`).
 */
function PlaceCount({ count, end = false }: { count: number; end?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        COUNT,
        end
          ? "ml-auto hidden h-6 min-w-6 px-1.5 text-small lg:grid"
          : "absolute -top-1 right-1.5 grid h-5 min-w-5 px-1 text-tab",
      )}
    >
      {count > MOST_SHOWN ? `${MOST_SHOWN}+` : count}
    </span>
  );
}

/** A place's name, with how many wait there when any do (D337): "Queue, 3 to bill". */
const namedWith = (label: string, count: number) =>
  count > 0 ? UI_TEXT.nav.counted(label, UI_TEXT.billing.toBillCount(count)) : undefined;

/**
 * One place in the rail — its icon over its name, the icon on a patch of land
 * while current — and, from 1024 px, in the sidebar: a capsule, all land
 * while current.
 */
export function SidePlace({
  item: { href, label, icon: Icon },
  active,
  count = 0,
}: {
  item: Place;
  active: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={namedWith(label, count)}
      className={cn(
        "group flex items-center rounded-full transition-colors duration-(--duration-map) ease-map",
        "max-lg:flex-col max-lg:gap-1 max-lg:py-1 max-lg:text-tab",
        "lg:min-h-11 lg:gap-3 lg:px-3",
        active ? "font-bold text-ink lg:bg-land lg:text-land-ink" : "text-muted hover:text-ink lg:hover:bg-surface",
      )}
    >
      <span
        className={cn(
          "relative grid shrink-0 place-items-center rounded-full transition-colors duration-(--duration-map) ease-map",
          "max-lg:h-8 max-lg:w-14",
          active && "max-lg:bg-land max-lg:text-land-ink",
        )}
      >
        <Icon size={22} strokeWidth={2.25} aria-hidden="true" />
        <span className="lg:hidden">
          <PlaceCount count={count} />
        </span>
      </span>
      <span className="max-w-full truncate">{label}</span>
      <PlaceCount count={count} end />
    </Link>
  );
}
