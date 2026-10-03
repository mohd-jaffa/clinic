"use client";

import { Archive, ArchiveRestore, ChevronUp } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
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
  const [shown, setShown] = useState(false);
  const listId = useId();
  if (entries.length === 0) return null;

  return (
    <section aria-label={catalogues.archived} className={className}>
      {/* Its words, not its padding, line up with the rows. */}
      <div className="-ml-3.5">
        <Button
          label={shown ? catalogues.hideArchived : catalogues.showArchived(entries.length)}
          icon={shown ? ChevronUp : Archive}
          variant="quiet"
          size="sm"
          aria-expanded={shown}
          aria-controls={listId}
          onClick={() => setShown(!shown)}
        />
      </div>
      <div id={listId} hidden={!shown} className="mt-3">
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
      </div>
    </section>
  );
}
