import Papa from "papaparse";

import type { ErrorMessageCode } from "@/constants/messages";

/**
 * Reading a patient import's file (plan §10.5, D127), in the browser: a CSV,
 * or the first sheet of an Excel workbook (.xlsx). The file is never sent or
 * kept — only what the owner then imports leaves the device, row by checked
 * row. Its first row that holds anything is the header; a row with nothing
 * in it is passed over, and every other keeps its line in the file, so a
 * problem is named by the row the owner sees in their spreadsheet.
 */

/** What a cell holds: text, a number, a true or false, or a date (Excel's date cells). */
export type ImportCell = string | number | boolean | Date | null;

export interface ImportSheetRow {
  /** Its row in the file, the header being 1 if it is the first. */
  line: number;
  cells: ImportCell[];
}

export interface ImportSheet {
  name: string;
  /** One per column, "" for a column with no header. */
  headers: string[];
  rows: ImportSheetRow[];
}

export type ImportFileErrorCode = Extract<
  ErrorMessageCode,
  "IMPORT_FILE_TYPE" | "IMPORT_FILE_XLS" | "IMPORT_FILE_UNREADABLE" | "IMPORT_FILE_EMPTY"
>;

/** Why a file could not be read, in the words of `ERROR_MESSAGES`. */
export class ImportFileError extends Error {
  constructor(readonly code: ImportFileErrorCode) {
    super(code);
    this.name = "ImportFileError";
  }
}

const isEmpty = (cell: ImportCell) =>
  cell === null || cell === undefined || (typeof cell === "string" && cell.trim() === "");

/** The file's rows as a spreadsheet holds them, by what the file says it is. */
async function cellsOf(file: File): Promise<ImportCell[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = (await file.text()).replace(/^﻿/, "");
    // Blank lines are kept here, so each row keeps the number a spreadsheet gives it.
    return Papa.parse<string[]>(text).data;
  }
  if (name.endsWith(".xls")) throw new ImportFileError("IMPORT_FILE_XLS");
  if (!name.endsWith(".xlsx")) throw new ImportFileError("IMPORT_FILE_TYPE");
  // Only this screen reads workbooks, so the reader is fetched only here.
  const { readSheet } = await import("read-excel-file/browser");
  try {
    // Its types say a date cell is `typeof Date`; it is a Date, as its documentation says.
    return (await readSheet(file)) as unknown as ImportCell[][];
  } catch (failure) {
    const code = (failure as { code?: string }).code;
    throw new ImportFileError(code === "XLS_FILE_NOT_SUPPORTED" ? "IMPORT_FILE_XLS" : "IMPORT_FILE_UNREADABLE");
  }
}

export async function readImportFile(file: File): Promise<ImportSheet> {
  let cells: ImportCell[][];
  try {
    cells = await cellsOf(file);
  } catch (failure) {
    if (failure instanceof ImportFileError) throw failure;
    throw new ImportFileError("IMPORT_FILE_UNREADABLE");
  }

  const filled = cells
    .map((row, index) => ({ line: index + 1, cells: row }))
    .filter((row) => row.cells.some((cell) => !isEmpty(cell)));
  const [header, ...rows] = filled;
  if (!header || rows.length === 0) throw new ImportFileError("IMPORT_FILE_EMPTY");

  const width = Math.max(...filled.map((row) => row.cells.length));
  const headers = Array.from({ length: width }, (_, index) => {
    const cell = header.cells[index];
    return isEmpty(cell) ? "" : String(cell).trim();
  });
  return { name: file.name, headers, rows };
}
