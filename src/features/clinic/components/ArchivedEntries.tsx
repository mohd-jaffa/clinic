"use client";

import { Archive, ArchiveRestore } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Row, RowList } from "@/components/ui/row";
import { UI_TEXT } from "@/constants/messages";

import type { CatalogueEntry } from "../types";

const { catalogues } = UI_TEXT;

/**
 * A catalogue's archived entries (D80): out of the way behind **Show
 * archived**, each with **Restore**, which brings it back to the list. In a
 * view-only clinic they are shown and not restored. Nothing at all when none
 * is archived.
 */
export function ArchivedEntries<Entry extends CatalogueEntry>({
  entries,
  describe,
  onRestore,
  restoring,
  className,
}: {
  entries: readonly Entry[];
  /** The line under each name — its category and price, its length. */
  describe?: (entry: Entry) => string;
  /** None while the clinic is view-only. */
  onRestore?: (entry: Entry) => void;
  /** The entry being restored now. */
  restoring?: string | null;
  className?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <Disclosure
      label={catalogues.archived}
      showLabel={catalogues.showArchived(entries.length)}
      hideLabel={catalogues.hideArchived}
      icon={Archive}
      className={className}
    >
      <RowList look="menu" label={catalogues.archived}>
        {entries.map((entry) => (
          <Row
            key={entry.id}
            look="menu"
            title={entry.name}
            subtitle={describe?.(entry)}
            trailing={
              onRestore && (
                <Button
                  label={catalogues.restore}
                  aria-label={catalogues.restoreNamed(entry.name)}
                  icon={ArchiveRestore}
                  variant="quiet"
                  size="sm"
                  loading={restoring === entry.id}
                  onClick={() => onRestore(entry)}
                />
              )
            }
          />
        ))}
      </RowList>
    </Disclosure>
  );
}
