"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { cn } from "@/components/ui/cn";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { CONSOLE_BOTTOM_NAV, CONSOLE_MORE_NAV, CONSOLE_NAV_GROUPS, isConsolePlace } from "@/constants/navigation";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { useNavigationPending } from "@/hooks/useNavigationPending";

import { AccountMenu } from "./AccountMenu";
import { ConsoleMoreSheet } from "./ConsoleMoreSheet";
import { BAR_PLACE, BarMark, BarPlace, SidePlace } from "./NavPlaces";
import { OfflineBanner } from "./OfflineBanner";

/**
 * The frame of the developer console (plan §20; D367), as the app's is drawn
 * but with the console's own places and nothing to add:
 *
 * - **Phone:** a bottom bar — Overview · Clinics · Accounts · More, which
 *   holds Settings, the Error log, the Audit and Sign out.
 * - **Tablet:** the icon rail with every place, the account at its foot.
 * - **Desktop:** the sidebar headed **Console**, the places in two groups,
 *   the account — "Developer" — at its foot.
 *
 * Only the platform admin sees it: anyone else signed in is sent Home, as the
 * routes behind it refuse them anyway.
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth for="developer">
      <ConsoleFrame>{children}</ConsoleFrame>
    </RequireAuth>
  );
}

function ConsoleFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigating = useNavigationPending(pathname);
  const behindMore = CONSOLE_MORE_NAV.some((place) => isConsolePlace(place, pathname));

  return (
    <div className="min-h-dvh bg-ground text-ink md:flex">
      <aside
        className={cn(
          "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-ground md:flex",
          "pl-[var(--safe-left)] md:w-[calc(6.5rem+var(--safe-left))] lg:w-[calc(17rem+var(--safe-left))]",
        )}
      >
        <div className="safe-top [--safe-pt:1.25rem] px-2 pb-3 lg:px-4">
          <p className="hidden px-2 text-title font-bold lg:block">{UI_TEXT.console.title}</p>
        </div>

        <nav aria-label={UI_TEXT.nav.main} className="min-h-0 flex-1 overflow-y-auto px-2 py-2 lg:px-4">
          {CONSOLE_NAV_GROUPS.map((group) => (
            <ul
              key={group[0].id}
              role="list"
              className="grid gap-1 not-first:mt-3 not-first:border-t not-first:border-line not-first:pt-3"
            >
              {group.map((place) => (
                <li key={place.id}>
                  <SidePlace item={place} active={isConsolePlace(place, pathname)} />
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
        {navigating && <ScreenSkeleton label={UI_TEXT.states.loading} />}
        {children}
      </main>

      <nav
        aria-label={UI_TEXT.nav.main}
        data-bottom-nav=""
        className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ground md:hidden"
      >
        <ul role="list" className="grid h-16 grid-cols-4 grid-rows-1">
          {CONSOLE_BOTTOM_NAV.map((place) => (
            <li key={place.id} className="min-w-0">
              <BarPlace item={place} active={isConsolePlace(place, pathname)} />
            </li>
          ))}
          <li className="min-w-0">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-current={behindMore || undefined}
              onClick={() => setMoreOpen(true)}
              className={BAR_PLACE}
            >
              <BarMark icon={Menu} label={UI_TEXT.nav.more} active={moreOpen || behindMore} />
            </button>
          </li>
        </ul>
      </nav>

      <ConsoleMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
