import { IMPORT_GENDER_WORDS, IMPORT_MONTHS } from "@/constants/import";
import { UI_TEXT } from "@/constants/messages";
import { GENDERS } from "@/constants/statuses";
import { isDayKey, utcDayKey } from "@/lib/dates/calendar";
import { importRowSchema, type ImportRowInput } from "@/lib/validation";

import type { ColumnMap } from "./import-columns";
import type { ImportCell, ImportSheet } from "./import-file";
import type { ImportMatch } from "./types";

const { patientImport } = UI_TEXT;

/**
 * Checking an import's rows (plan §10.5, D129, D130): each row read into a
 * patient as the add sheet would have it typed, and checked by the same
 * schema the server checks it with — so the preview's verdict is the
 * server's. A row that passes is ready; one that does not says why.
 */
export interface CheckedRow {
  /** Its row in the file. */
  line: number;
  cells: ImportCell[];
  /** The key it is sent under, so sending it again adds no one twice. */
  key: string;
  /** What is sent, as typed; null while it has problems. */
  input: ImportRowInput | null;
  /** Its name as read, and its mobile in +91 form once it passed. */
  name: string;
  phone: string | null;
  problems: string[];
}

/** What a possible duplicate matched: a patient already in the clinic, or an earlier row of the file. */
export type DuplicateOf = { kind: "PATIENT"; number: number; name: string } | { kind: "ROW"; line: number };

/** A cell as text: a date as its day, a number as its digits, nothing as "". */
export function cellText(cell: ImportCell | undefined): string {
  if (cell instanceof Date) return utcDayKey(cell);
  if (typeof cell === "string") return cell.trim();
  if (typeof cell === "number") return String(cell);
  return "";
}

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
/** Day first, as India writes it (D130): 03/04/1990 is 3 April. */
const DAY_FIRST = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const NAMED_MONTH = /^(\d{1,2})[\s-]+([a-z]{3,9})[\s,-]+(\d{4})$/i;

const key = (year: string, month: number, day: string) =>
  `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;

/**
 * A date of birth as a day key: a date cell as its day; text as 1990-04-03,
 * 03/04/1990 (day first) or 3 Apr 1990. Text read no other way is handed on
 * as it is, for the schema to refuse in its own words.
 */
export function dayOf(cell: ImportCell | undefined): string {
  if (cell instanceof Date) return utcDayKey(cell);
  const text = cellText(cell);
  const iso = ISO.exec(text);
  const dayFirst = DAY_FIRST.exec(text);
  const named = NAMED_MONTH.exec(text);
  const read = iso
    ? key(iso[1], Number(iso[2]), iso[3])
    : dayFirst
      ? key(dayFirst[3], Number(dayFirst[2]), dayFirst[1])
      : named && IMPORT_MONTHS.includes(named[2].slice(0, 3).toLowerCase())
        ? key(named[3], IMPORT_MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1, named[1])
        : null;
  return read !== null && isDayKey(read) ? read : text;
}

/** An age as years: "34", "34 y", "34 yrs", "34 years"; anything else as it is. */
export function yearsOf(cell: ImportCell | undefined): string {
  const text = cellText(cell);
  return /^(\d{1,3})\s*(y|yrs?|years?)?\.?$/i.exec(text)?.[1] ?? text;
}

/** A gender by its word — M, Male, F, Female, O, Other — or as it is, for the schema to refuse. */
export function genderOf(cell: ImportCell | undefined): string {
  const text = cellText(cell);
  return GENDERS.find((gender) => IMPORT_GENDER_WORDS[gender].includes(text.toLowerCase())) ?? text;
}

export function checkRows(
  sheet: ImportSheet,
  map: ColumnMap,
  newKey: () => string = () => crypto.randomUUID(),
): CheckedRow[] {
  return sheet.rows.map(({ line, cells }) => {
    const at = (column: number | null) => (column === null ? undefined : cells[column]);
    const date = dayOf(at(map.dateOfBirth));
    const years = yearsOf(at(map.age));
    // The date of birth when it was given; else the age; else whichever column was chosen, empty.
    const born =
      date !== ""
        ? { as: "DATE" as const, date }
        : years !== "" || map.dateOfBirth === null
          ? { as: "AGE" as const, years }
          : { as: "DATE" as const, date };
    const typed: ImportRowInput = {
      key: newKey(),
      fullName: cellText(at(map.fullName)),
      phone: cellText(at(map.phone)),
      born,
      gender: genderOf(at(map.gender)) as ImportRowInput["gender"],
      altPhone: cellText(at(map.altPhone)),
      email: cellText(at(map.email)),
      address: cellText(at(map.address)),
      emergencyContactName: cellText(at(map.emergencyContactName)),
      emergencyContactPhone: cellText(at(map.emergencyContactPhone)),
      notes: cellText(at(map.notes)),
    };
    const checked = importRowSchema.safeParse(typed);
    // Said as a file is fixed: what the cell should hold, not what to choose.
    const problemOf = ({ path, message }: { path: PropertyKey[]; message: string }) =>
      path[0] === "gender"
        ? patientImport.genderUnread
        : path[1] === "date" && date !== "" && !isDayKey(date)
          ? patientImport.dateUnread
          : message;
    return {
      line,
      cells,
      key: typed.key,
      input: checked.success ? typed : null,
      name: checked.success ? checked.data.fullName : typed.fullName,
      phone: checked.success ? checked.data.phone : null,
      problems: checked.success ? [] : [...new Set(checked.error.issues.map(problemOf))],
    };
  });
}

/** A name's words, lower-cased, without its punctuation. */
const wordsOf = (name: string) =>
  name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Whether two names on one mobile may be one person (D129): every word of
 * the shorter is in the longer — "Rohan Mehta" and "Mr Rohan K Mehta" — but
 * not "Rohan Mehta" and "Riya Mehta", a family on one number.
 */
export function similarNames(a: string, b: string): boolean {
  const [shorter, longer] = [wordsOf(a), wordsOf(b)].sort((x, y) => x.length - y.length);
  return shorter.length > 0 && shorter.every((word) => longer.includes(word));
}

/**
 * The ready rows that may be someone already here (plan §10.5, D129): the
 * same mobile and a similar name as a patient of the clinic's, or as an
 * earlier ready row of the file — the first of those is kept. By line.
 */
export function findDuplicates(
  rows: readonly CheckedRow[],
  existing: readonly ImportMatch[],
): Map<number, DuplicateOf> {
  // By mobile, so ten thousand rows are each compared with their own family only.
  const here = new Map<string, ImportMatch[]>();
  for (const match of existing) here.set(match.phone, [...(here.get(match.phone) ?? []), match]);
  const kept = new Map<string, CheckedRow[]>();
  const duplicates = new Map<number, DuplicateOf>();
  for (const row of rows) {
    if (row.input === null || row.phone === null) continue;
    const patient = here.get(row.phone)?.find((match) => similarNames(match.name, row.name));
    const family = kept.get(row.phone) ?? [];
    const earlier = family.find((other) => similarNames(other.name, row.name));
    if (patient) duplicates.set(row.line, { kind: "PATIENT", number: patient.number, name: patient.name });
    else if (earlier) duplicates.set(row.line, { kind: "ROW", line: earlier.line });
    else kept.set(row.phone, [...family, row]);
  }
  return duplicates;
}
