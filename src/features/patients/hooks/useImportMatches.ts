"use client";

import { useEffect, useState } from "react";

import { ImportClient } from "../api.client";
import { findDuplicates, type CheckedRow, type DuplicateOf } from "../import-rows";
import type { ImportMatch } from "../types";

type Checked = { status: "DONE"; duplicates: Map<number, DuplicateOf> } | { status: "FAILED"; failure: unknown };

/**
 * The possible duplicates among an import's ready rows (plan §10.5, D129):
 * the clinic's patients on their mobiles are asked for a batch of mobiles at
 * a time — in the body, never the address (D98) — and the rows compared
 * with them and with each other. Held in memory only, for this screen.
 */
export function useImportMatches(rows: readonly CheckedRow[], batchSize: number) {
  const [attempt, setAttempt] = useState(0);
  // What was found, and for which rows and which try: anything else is still being checked.
  const [found, setFound] = useState<{ rows: readonly CheckedRow[]; attempt: number; checked: Checked } | null>(null);

  useEffect(() => {
    let live = true;
    const phones = [...new Set(rows.flatMap((row) => (row.phone === null ? [] : [row.phone])))];
    void (async () => {
      let checked: Checked;
      try {
        const matches: ImportMatch[] = [];
        for (let start = 0; start < phones.length; start += batchSize) {
          matches.push(...(await ImportClient.matches(phones.slice(start, start + batchSize))));
        }
        checked = { status: "DONE", duplicates: findDuplicates(rows, matches) };
      } catch (failure) {
        checked = { status: "FAILED", failure };
      }
      if (live) setFound({ rows, attempt, checked });
    })();
    return () => {
      live = false;
    };
  }, [rows, batchSize, attempt]);

  const current = found !== null && found.rows === rows && found.attempt === attempt ? found.checked : null;
  return { checked: current, retry: () => setAttempt((count) => count + 1) };
}
