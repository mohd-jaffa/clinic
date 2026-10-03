"use client";

import type { ReactNode } from "react";

import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed, type ListQuery } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT, type ErrorMessageCode } from "@/constants/messages";
import { SETTINGS_ROUTE } from "@/constants/navigation";

/** How many of a catalogue's entries are offered: the archived ones are not. */
export const activeCount = (entries: readonly { active: boolean }[]) => entries.filter((entry) => entry.active).length;

/**
 * A list the clinic keeps in Settings (plan §9): the land with its title, how
 * many it holds and the way back to Settings; on the ground, its entries once
 * they are here, rows standing in while they load, or why they could not and
 * **Try again**. The price list, appointment types, expense categories and
 * holidays and leave share it.
 */
export function CatalogueScreen<Entry>({
  title,
  subtitle,
  query,
  loadFailed,
  children,
}: {
  title: string;
  /** How many it holds, in words, once they are here — "12 services", "3 coming up". */
  subtitle?: string;
  query: ListQuery & { data?: readonly Entry[] };
  loadFailed: ErrorMessageCode;
  children: (entries: readonly Entry[]) => ReactNode;
}) {
  const entries = query.data;
  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={title} subtitle={subtitle} back={SETTINGS_ROUTE} />
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
