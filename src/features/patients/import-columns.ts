import { IMPORT_FIELDS, IMPORT_HEADER_WORDS, IMPORT_REQUIRED, type ImportField } from "@/constants/import";

/**
 * Which of a file's columns fills each patient field (plan §10.5): guessed
 * from the headers, then checked by the owner. A column fills one field at
 * most; a field no column fills is null.
 */
export type ColumnMap = Record<ImportField, number | null>;

/** A header as it is compared: lower-cased, letters and digits only ("Mobile No." → "mobileno"). */
const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * When no header says a field's word outright, the first that holds one of
 * its longer words takes it — the more particular fields first, so
 * "Emergency contact phone" is the emergency contact's phone, not the mobile,
 * and "Patient's mobile number" the mobile, not the name.
 */
const BY_CONTAINING: readonly ImportField[] = [
  "emergencyContactPhone",
  "emergencyContactName",
  "altPhone",
  "dateOfBirth",
  "phone",
  "fullName",
  "age",
  "gender",
  "email",
  "address",
  "notes",
];

/** The shortest word a header is searched for inside it: "dob" or "sex" must be the whole header. */
const CONTAINED_LENGTH = 4;

export function guessColumns(headers: readonly string[]): ColumnMap {
  const squashed = headers.map(squash);
  const map = Object.fromEntries(IMPORT_FIELDS.map((field) => [field, null])) as ColumnMap;
  const taken = new Set<number>();
  const take = (field: ImportField, found: (header: string) => boolean) => {
    if (map[field] !== null) return;
    const index = squashed.findIndex((header, at) => header !== "" && !taken.has(at) && found(header));
    if (index === -1) return;
    map[field] = index;
    taken.add(index);
  };

  for (const field of IMPORT_FIELDS) take(field, (header) => IMPORT_HEADER_WORDS[field].includes(header));
  for (const field of BY_CONTAINING) {
    const words = IMPORT_HEADER_WORDS[field].filter((word) => word.length >= CONTAINED_LENGTH);
    take(field, (header) => words.some((word) => header.includes(word)));
  }
  return map;
}

/** What a map still lacks before rows can be checked: each required field, and a birth (date or age). */
export function missingColumns(map: ColumnMap): { fields: ImportField[]; born: boolean } {
  return {
    fields: IMPORT_REQUIRED.filter((field) => map[field] === null),
    born: map.dateOfBirth === null && map.age === null,
  };
}

/** A column's letter, as a spreadsheet names it: A … Z, AA, AB … */
export function columnLetter(index: number): string {
  let letters = "";
  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters;
  }
  return letters;
}
