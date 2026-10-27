"use client";

import { useId, type ReactNode } from "react";

import { cn } from "@/components/ui/cn";
import { LoadFailed, type ListQuery } from "@/components/ui/list-screen";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { UI_TEXT } from "@/constants/messages";

/**
 * A report as it loads (plan §18): skeletons the first time; then, while
 * another day or month is read, the last one kept in place, dimmed, so
 * nothing jumps; a notice with **Try again** if it cannot be read.
 */
export function ReportFrame<T>({
  query,
  current,
  children,
}: {
  query: ListQuery & { data?: T };
  /** Whether what is shown is the day or month asked for. */
  current: (report: T) => boolean;
  children: (report: T) => ReactNode;
}) {
  const report = query.data;
  if (report === undefined || (query.error != null && !current(report))) {
    return query.error != null ? (
      <LoadFailed query={query} loadFailed="REPORT_LOAD_FAILED" />
    ) : (
      <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
        <SkeletonRows rows={3} />
      </section>
    );
  }
  const stale = !current(report);
  return (
    <div
      aria-busy={stale}
      className={cn("grid gap-8 transition-opacity duration-(--duration-map) ease-map", stale && "opacity-60")}
    >
      {children(report)}
    </div>
  );
}

/** A report's figures under their heading — "Money" — side by side, as many to a row as fit. */
export function FigureSection({ title, figures }: { title: string; figures: { label: string; value: string }[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={title} />
      <StatGrid>
        {figures.map((figure) => (
          <StatTile key={figure.label} label={figure.label} value={figure.value} />
        ))}
      </StatGrid>
    </section>
  );
}
