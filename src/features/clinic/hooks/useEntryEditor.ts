"use client";

import { useState } from "react";

/**
 * Which entry a catalogue's sheet is open for: a new one (`entry` null) or
 * one being changed. The entry stays as the sheet closes, so it leaves
 * showing what it came with; `key` gives each entry its own form, so what was
 * typed for one is never shown for another, and reopening the same one finds
 * it as it was left (D55).
 */
export function useEntryEditor<Entry extends { id: string }>() {
  const [state, setState] = useState<{ open: boolean; entry: Entry | null }>({ open: false, entry: null });
  return {
    open: state.open,
    entry: state.entry,
    key: state.entry?.id ?? "new",
    add: () => setState({ open: true, entry: null }),
    edit: (entry: Entry) => setState({ open: true, entry }),
    close: () => setState((current) => ({ ...current, open: false })),
  };
}
