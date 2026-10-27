"use client";

import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { UI_TEXT } from "@/constants/messages";
import { QUEUE_ROUTE, REPORTS_ROUTE } from "@/constants/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import { clinicHour, todayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { formatLongDate } from "@/lib/format/date";

import { greetingOf } from "../greeting";
import { useDashboard } from "../hooks/useDashboard";
import { GettingStarted } from "./GettingStarted";
import { HomeSections } from "./HomeSections";

const { home: words } = UI_TEXT;

/**
 * Home — `/home` (plan §17, §32.1; D345 – D353): operational, not
 * analytical. The land greets the person by the clinic's clock — a doctor as
 * "Dr. Rahul" — under it today's date and how many appointments it holds,
 * then how many wait and how many were seen in display numerals (D350). On
 * the ground, Collected today (opening Reports) and Outstanding for `reports.view`, then the
 * sections each person's permissions open, in two columns on a desktop. A
 * clinic with no patient yet sees its getting-started steps instead (D348).
 * Read again every 15 s and on focus (D353).
 */
export function Home() {
  const { profile, membership } = useAuth();
  const query = useDashboard();
  const home = query.data;
  const starting = home?.gettingStarted != null;
  const waiting = home?.queue?.reduce((sum, doctor) => sum + doctor.waiting, 0);
  const date = formatLongDate(home?.today ?? todayKey());

  return (
    <>
      <CoastHeader>
        <div className="grid gap-5 pb-6">
          <PageHeader
            title={greetingOf(profile?.fullName ?? "", membership?.doctorId != null, clinicHour())}
            subtitle={home?.day && !starting ? `${date} · ${words.appointments(home.day.appointments)}` : date}
          />
          {home && !starting && (waiting !== undefined || home.day) && (
            // Side by side, near each other, however wide the land.
            <div className="max-w-md">
              <StatGrid>
                {waiting !== undefined && (
                  <StatTile on="land" label={words.waiting} value={String(waiting)} href={QUEUE_ROUTE} />
                )}
                {home.day && <StatTile on="land" label={words.seen} value={String(home.day.patientsSeen)} />}
              </StatGrid>
            </div>
          )}
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        <div className="grid max-w-6xl grid-cols-1 gap-8">
          {home === undefined ? (
            query.error != null ? (
              <LoadFailed query={query} loadFailed="DASHBOARD_LOAD_FAILED" />
            ) : (
              <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
                <SkeletonRows rows={3} />
              </section>
            )
          ) : starting ? (
            <GettingStarted steps={home.gettingStarted!} />
          ) : (
            <>
              {home.money && (
                <section aria-label={words.money}>
                  <StatGrid>
                    <StatTile
                      label={words.collected}
                      value={formatPaise(home.money.collectedPaise)}
                      href={REPORTS_ROUTE}
                    />
                    <StatTile label={words.outstanding} value={formatPaise(home.money.outstandingPaise)} />
                  </StatGrid>
                </section>
              )}
              <HomeSections home={home} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
