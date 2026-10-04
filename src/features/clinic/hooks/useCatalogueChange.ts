"use client";

import { Archive } from "lucide-react";
import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { useApiMutation } from "@/lib/query/useApiMutation";

import type { EntryChange } from "../api.client";
import type { CatalogueEntry } from "../types";

const { catalogues } = UI_TEXT;

/**
 * Archiving and restoring one of a catalogue's entries (D80). Archive asks
 * first (AGENTS.md §23) — a card saying what archiving it means — and
 * answers whether it was archived, so the sheet it was asked from can close.
 * Restore needs no asking: it only brings an entry back. A refusal — the last
 * of what the clinic keeps (D83), or a name an active entry now has — is an
 * error card in the API's words.
 */
export function useCatalogueChange<Entry extends CatalogueEntry>({
  change,
  list,
}: {
  change: (input: EntryChange<never>) => Promise<Entry>;
  /** The catalogue's list route, read again after a change. */
  list: string;
}) {
  const respond = useResponse();
  // The entry being restored, so only its row shows it.
  const [restoring, setRestoring] = useState<string | null>(null);
  const mutation = useApiMutation(change, {
    revalidate: [list],
    onSuccess: (saved) =>
      respond.success({
        title: saved.active ? catalogues.restoredNote(saved.name) : catalogues.archivedNote(saved.name),
      }),
    onError: (failure) => respond.failure(failure, { title: catalogues.notChanged }),
  });

  /** `card` says what archiving this entry means. */
  const archive = async (entry: Entry, card: { title: string; message: string }): Promise<boolean> => {
    const sure = await respond.confirm({
      ...card,
      confirmLabel: UI_TEXT.actions.archive,
      confirmIcon: Archive,
    });
    if (!sure) return false;
    return (await mutation.submit({ id: entry.id, active: false })) !== undefined;
  };

  const restore = async (entry: Entry) => {
    setRestoring(entry.id);
    await mutation.submit({ id: entry.id, active: true });
    setRestoring(null);
  };

  return { archive, restore, restoring, archiving: mutation.submitting && restoring === null };
}
