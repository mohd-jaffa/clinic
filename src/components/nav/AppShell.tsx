"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { cn } from "@/components/ui/cn";
import { QuickActions } from "@/components/ui/quick-actions";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import {
  BOTTOM_NAV,
  isActivePath,
  MORE_NAV,
  NAV_GROUPS,
  placesFor,
  quickAddFor,
  type NavItem,
} from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { useToBillCount } from "@/features/billing/hooks/useToBillCount";
import { ClinicLogo } from "@/features/clinic/components/ClinicLogo";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useNavigationPending } from "@/hooks/useNavigationPending";

import { AccountMenu } from "./AccountMenu";
import { MoreSheet } from "./MoreSheet";
import { OfflineBanner } from "./OfflineBanner";
import { PlanBanner } from "./PlanBanner";
import { AddButton } from "./QuickAdd";

/**
 * The frame every signed-in screen sits in (plan §31.1, §32.1):
 *
 * - **Phone (< 768 px):** no top bar (D68) — each screen's land carries its
 *   title. A bottom bar on the ground: Home · Queue · ＋ · Patients · More,
 *   each in its own place whatever the others, so the ＋ stays in the middle;
 *   More opens the rest, the account and Sign out.
 * - **Tablet (768–1023 px):** an icon rail on the ground, each place's name
 *   under its icon, the round ＋ at its top (D69) and the account at its foot.
 * - **Desktop (≥ 1024 px):** the sidebar on the ground — the clinic's name,
 *   the **Add** capsule, the places in three groups, the account at its foot.
 *
 * A band leads every screen while the connection is gone (`OfflineBanner`)
 * and while the clinic's plan is not active (`PlanBanner`); in a view-only
 * clinic the ＋ still opens its actions, each turned off and saying why
 * (plan §7.2).
 *
 * For whoever reads bills, the Queue item carries a small coral count of the
 * visits waiting in To bill (D337), read beside the screen and again every
 * 15 s, as the queue is.
 *
 * Only the places and quick adds the person may use are shown. The current
 * place is a patch of land behind its icon — or, in the sidebar, behind the
 * whole of it. A screen slow to arrive shows its skeleton in the old one's
 * place, the navigation kept. Every edge pays its safe area. Every screen is drawn inside
 * this, so the session gate lives here too: no page has to remember it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppFrame>{children}</AppFrame>
    </RequireAuth>
  );
}

function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { membership } = useAuth();
  const { readOnly, reason } = useReadOnly();
  const [moreOpen, setMoreOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  // On the way to another screen: its skeleton in this one's place, the navigation kept.
  const navigating = useNavigationPending(pathname);

  // While the session is still being checked the frame is drawn out of sight, with nothing in it yet.
  const may = (items: readonly NavItem[]) => (membership ? placesFor(membership, items) : []);
  const adds = membership ? quickAddFor(membership) : [];
  const groups = NAV_GROUPS.map(may).filter((group) => group.length > 0);
  const [home, queue] = BOTTOM_NAV.start.map((item) => may([item])[0]);
  const [patients] = BOTTOM_NAV.end.map((item) => may([item])[0]);
  const billsQueue = queue !== undefined && membership !== null && hasAccess(membership, "payments.view");
  const toBill = useToBillCount(billsQueue).data?.count ?? 0;
  const countOf = (item: NavItem) => (item.id === "queue" ? toBill : 0);
  const behindMore = MORE_NAV.some((item) => isActivePath(item.href, pathname));
  const openAdd = () => setAdding(true);

  return (
    <div className="min-h-dvh bg-ground text-ink md:flex">
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-ground md:flex",
          "pl-[var(--safe-left)] md:w-[calc(6.5rem+var(--safe-left))] lg:w-[calc(17rem+var(--safe-left))]",
        )}
      >
        <div className="safe-top [--safe-pt:1.25rem] grid gap-5 px-2 pb-3 max-lg:justify-items-center lg:px-4">
          <div className="hidden items-center gap-3 px-2 lg:flex">
            {membership && <ClinicLogo url={membership.clinicLogoUrl} clinic={membership.clinicName} size="sm" />}
            <p className="line-clamp-2 min-w-0 text-title font-bold break-words">{membership?.clinicName}</p>
          </div>
          {adds.length > 0 && (
            <>
              <span className="lg:hidden">
                <AddButton look="rail" open={adding} onClick={openAdd} />
              </span>
              <span className="hidden lg:block">
                <AddButton look="sidebar" open={adding} onClick={openAdd} />
              </span>
            </>
          )}
        </div>

        <nav aria-label={UI_TEXT.nav.main} className="min-h-0 flex-1 overflow-y-auto px-2 py-2 lg:px-4">
          {groups.map((group) => (
            <ul
              key={group[0].id}
              role="list"
              className="grid gap-1 not-first:mt-3 not-first:border-t not-first:border-line not-first:pt-3"
            >
              {group.map((item) => (
                <li key={item.id}>
                  <SidePlace item={item} active={isActivePath(item.href, pathname)} count={countOf(item)} />
                </li>
              ))}
            </ul>
          ))}
        </nav>

        <div className="safe-bottom [--safe-pb:1rem] border-t border-line px-2 pt-3 lg:px-4">
          <AccountMenu />
        </div>
      </aside>

      <main
        aria-busy={navigating || undefined}
        data-navigating={navigating || undefined}
        className="min-w-0 flex-1 pb-[calc(var(--bottom-bar-offset)+var(--safe-bottom)+2rem)]"
      >
        <OfflineBanner />
        <PlanBanner />
        {navigating && <ScreenSkeleton label={UI_TEXT.states.loading} />}
        {children}
      </main>

      <nav
        aria-label={UI_TEXT.nav.main}
        data-bottom-nav=""
        className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ground md:hidden"
      >
        <ul role="list" className="grid h-16 grid-cols-5 grid-rows-1">
          {home && (
            <li className="col-start-1 min-w-0">
              <BarPlace item={home} active={isActivePath(home.href, pathname)} />
            </li>
          )}
          {queue && (
            <li className="col-start-2 min-w-0">
              <BarPlace item={queue} active={isActivePath(queue.href, pathname)} count={toBill} />
            </li>
          )}
          {adds.length > 0 && (
            <li className="col-start-3 min-w-0">
              <AddButton look="bar" open={adding} onClick={openAdd} />
            </li>
          )}
          {patients && (
            <li className="col-start-4 min-w-0">
              <BarPlace item={patients} active={isActivePath(patients.href, pathname)} />
            </li>
          )}
          <li className="col-start-5 min-w-0">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              // The screen shown is one of those behind it.
              aria-current={behindMore || undefined}
              onClick={() => setMoreOpen(true)}
              className={BAR_PLACE}
            >
              <BarMark icon={Menu} label={UI_TEXT.nav.more} active={moreOpen || behindMore} />
            </button>
          </li>
        </ul>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <QuickActions
        open={adding}
        onClose={() => setAdding(false)}
        actions={adds.map(({ key, label, icon, href }) => ({ key, label, icon, href }))}
        blocked={readOnly ? reason : undefined}
      />
    </div>
  );
}

const BAR_PLACE = "flex h-full w-full flex-col items-center justify-center gap-1 text-tab";

/** One place in the bottom bar: its icon over its name, on a patch of land while current. */
function BarPlace({ item, active, count = 0 }: { item: NavItem; active: boolean; count?: number }) {
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

function BarMark({
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
function SidePlace({
  item: { href, label, icon: Icon },
  active,
  count,
}: {
  item: NavItem;
  active: boolean;
  count: number;
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
