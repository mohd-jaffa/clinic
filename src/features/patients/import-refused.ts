import Papa from "papaparse";

import { UI_TEXT } from "@/constants/messages";
import { utcDayKey } from "@/lib/dates/calendar";

import { columnLetter } from "./import-columns";
import type { ImportCell, ImportSheet } from "./import-file";

/** A row not imported, as it was in the file, and why. */
export interface RefusedRow {
  cells: ImportCell[];
  problem: string;
}

const csvCell = (cell: ImportCell | undefined) =>
  cell instanceof Date ? utcDayKey(cell) : cell === null || cell === undefined ? "" : String(cell);

/**
 * The rows not imported, as a CSV to fix and import again (plan §10.5, D133):
 * the file's own columns under its own headers, and a Problem column saying
 * why. Values are written back as they were, so a fixed file imports as the
 * first would have.
 */
export function refusedCsv(sheet: ImportSheet, rows: readonly RefusedRow[]): string {
  const headers = sheet.headers.map((header, index) => header || columnLetter(index));
  return Papa.unparse([
    [...headers, UI_TEXT.patientImport.problemColumn],
    ...rows.map(({ cells, problem }) => [...sheet.headers.map((_, index) => csvCell(cells[index])), problem]),
  ]);
}
