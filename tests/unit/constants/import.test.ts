import { describe, expect, it } from "vitest";

import {
  IMPORT_FIELDS,
  IMPORT_GENDER_WORDS,
  IMPORT_HEADER_WORDS,
  IMPORT_MONTHS,
  IMPORT_REQUIRED,
} from "@/constants/import";
import { UI_TEXT } from "@/constants/messages";
import { GENDERS } from "@/constants/statuses";

describe("a patient import's vocabulary (plan §10.5)", () => {
  it("names every field a column may fill, with words for its header and a label for the screen", () => {
    expect(Object.keys(IMPORT_HEADER_WORDS)).toEqual([...IMPORT_FIELDS]);
    expect(Object.keys(UI_TEXT.patientImport.fields)).toEqual([...IMPORT_FIELDS]);
    for (const field of IMPORT_REQUIRED) expect(IMPORT_FIELDS).toContain(field);
  });

  it("gives each header word to one field only, written as it is compared", () => {
    const words = Object.values(IMPORT_HEADER_WORDS).flat();
    expect(new Set(words).size).toBe(words.length);
    for (const word of words) expect(word, word).toMatch(/^[a-z0-9]+$/);
  });

  it("knows every gender by its words, each word for one gender only, and the twelve months", () => {
    expect(Object.keys(IMPORT_GENDER_WORDS)).toEqual([...GENDERS]);
    const words = Object.values(IMPORT_GENDER_WORDS).flat();
    expect(new Set(words).size).toBe(words.length);
    expect(IMPORT_MONTHS).toHaveLength(12);
  });
});
