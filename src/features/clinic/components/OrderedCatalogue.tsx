"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Row, RowList } from "@/components/ui/row";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";

import type { CatalogueEntry } from "../types";
import { ArchivedEntries } from "./ArchivedEntries";

/**
 * A short catalogue kept in the clinic's order — appointment types, expense
 * categories (plan §9): its entries as one menu list, each opening its sheet;
 * **Add** at the foot, where a new one goes (D81); the archived ones under
 * it, each to be restored (D80). One column at every width: a short list
 * reads down, not across. In a view-only clinic it is shown, not changed,
 * and says why.
 */
export function OrderedCatalogue<Entry extends CatalogueEntry>({
  entries,
  label,
  detail,
  addLabel,
  orderNote,
  onAdd,
  onEdit,
  onRestore,
  restoring,
}: {
  entries: readonly Entry[];
  /** What the list is, for a screen reader. */
  label: string;
  /** A value read at each row's end — a length. */
  detail?: (entry: Entry) => string;
  addLabel: string;
  /** Where a new one goes. */
  orderNote: string;
  onAdd: () => void;
  onEdit: (entry: Entry) => void;
  onRestore: (entry: Entry) => void;
  restoring: string | null;
}) {
  const { readOnly } = useReadOnly();
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-8">
      <section aria-label={label}>
        <RowList look="menu" label={label}>
          {entries
            .filter((entry) => entry.active)
            .map((entry) => (
              <Row
                key={entry.id}
                look="menu"
                title={entry.name}
                detail={detail?.(entry)}
                onClick={readOnly ? undefined : () => onEdit(entry)}
              />
            ))}
        </RowList>
        {readOnly ? (
          <ReadOnlyNote />
        ) : (
          <div className="mt-5">
            <Button label={addLabel} icon={Plus} onClick={onAdd} />
            <p className="mt-2.5 text-small text-muted">{orderNote}</p>
          </div>
        )}
      </section>
      <ArchivedEntries
        entries={entries.filter((entry) => !entry.active)}
        describe={detail}
        onRestore={readOnly ? undefined : onRestore}
        restoring={restoring}
      />
    </div>
  );
}
