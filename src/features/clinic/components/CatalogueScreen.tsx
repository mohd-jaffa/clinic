"use client";

import type { ReactNode } from "react";

import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed, type ListQuery } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT, type ErrorMessageCode } from "@/constants/messages";
import { SETTINGS_ROUTE } from "@/constants/navigation";

/**
 * A catalogue's screen (plan §9): the land with its title, how many it holds
 * and the way back to Settings; on the ground, its entries once they are
 * here, rows standing in while they load, or why they could not and
 * **Try again**. The price list, appointment types and expense categories
 * share it.
 */
export function CatalogueScreen<Entry>({
  title,
  count,
  query,
  loadFailed,
  children,
}: {
  title: string;
  /** How many are offered, in words — "12 services". */
  count: (active: number) => string;
  query: ListQuery & { data?: readonly (Entry & { active: boolean })[] };
  loadFailed: ErrorMessageCode;
  children: (entries: readonly (Entry & { active: boolean })[]) => ReactNode;
}) {
  const entries = query.data;
  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader
            title={title}
            subtitle={entries && count(entries.filter((entry) => entry.active).length)}
            back={SETTINGS_ROUTE}
          />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        {entries ? (
          children(entries)
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed={loadFailed} />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={5} />
          </section>
        )}
      </div>
    </>
  );
}
