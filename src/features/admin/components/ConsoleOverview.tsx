"use client";

import { useId } from "react";

import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { UI_TEXT } from "@/constants/messages";
import { CONSOLE_CLINICS_ROUTE } from "@/constants/navigation";
import { CLINIC_STANDING_LABELS, CLINIC_STANDINGS, type ConsoleClinicFilter } from "@/constants/statuses";
import { formatLongDate } from "@/lib/format/date";
import { withQuery } from "@/lib/query/keys";

import { useConsoleOverview } from "../hooks/useConsoleOverview";
import type { ConsoleOverview as Overview } from "../types";

const { console: words } = UI_TEXT;

/** The Clinics list kept to one filter: where a figure leads. */
const clinicsWith = (filter: ConsoleClinicFilter) => withQuery(CONSOLE_CLINICS_ROUTE, { filter });

/**
 * The console's Overview — `/admin` (plan §20.1; D368): the platform's
 * today and how many clinics on the land, with those waiting for activation
 * (No trial) beside it; on the ground the clinics by state — Trial, Active,
 * Ending soon, Ended, View only, each clinic once — then the sign-ups this
 * week and month and the extensions recorded this month. Each count of
 * clinics opens the Clinics list kept to them.
 */
export function ConsoleOverview() {
  const query = useConsoleOverview();
  const overview = query.data;

  return (
    <>
      <CoastHeader>
        <div className="grid gap-5 pb-6">
          <PageHeader
            title={words.places.overview}
            subtitle={overview && `${formatLongDate(overview.today)} · ${words.overviewSubtitle(overview.clinics)}`}
          />
          {overview && (
            <div className="max-w-md">
              <StatGrid>
                <StatTile
                  on="land"
                  label={words.places.clinics}
                  value={String(overview.clinics)}
                  href={CONSOLE_CLINICS_ROUTE}
                />
                <StatTile
                  on="land"
                  label={words.waiting}
                  value={String(overview.noTrial)}
                  href={clinicsWith("NO_TRIAL")}
                />
              </StatGrid>
            </div>
          )}
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        {overview ? (
          <Figures overview={overview} />
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed="CONSOLE_OVERVIEW_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={3} />
          </section>
        )}
      </div>
    </>
  );
}

function Figures({ overview }: { overview: Overview }) {
  const standingsId = useId();
  const latelyId = useId();
  return (
    <div className="grid max-w-4xl grid-cols-1 gap-8">
      <section aria-labelledby={standingsId}>
        <SectionHeading id={standingsId} title={words.byStanding} />
        <StatGrid>
          {CLINIC_STANDINGS.map((standing) => (
            <StatTile
              key={standing}
              label={CLINIC_STANDING_LABELS[standing]}
              value={String(overview.standings[standing])}
              href={clinicsWith(standing)}
            />
          ))}
        </StatGrid>
      </section>
      <section aria-labelledby={latelyId}>
        <SectionHeading id={latelyId} title={words.lately} />
        <StatGrid>
          <StatTile label={words.signupsWeek} value={String(overview.signupsWeek)} />
          <StatTile label={words.signupsMonth} value={String(overview.signupsMonth)} />
          <StatTile label={words.extensionsMonth} value={String(overview.extensionsMonth)} />
        </StatGrid>
      </section>
    </div>
  );
}
