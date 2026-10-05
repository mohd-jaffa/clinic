import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { guessColumns } from "@/features/patients/import-columns";
import type { ImportSheet } from "@/features/patients/import-file";
import {
  cellText,
  checkRows,
  dayOf,
  findDuplicates,
  genderOf,
  similarNames,
  yearsOf,
  type CheckedRow,
} from "@/features/patients/import-rows";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-05T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("reading a cell", () => {
  it("reads text trimmed, a number as its digits, a date as its day, and nothing as nothing", () => {
    expect(cellText("  Rohan  ")).toBe("Rohan");
    expect(cellText(9876543210)).toBe("9876543210");
    expect(cellText(new Date("1990-04-03T00:00:00Z"))).toBe("1990-04-03");
    expect([null, undefined, true].map(cellText)).toEqual(["", "", ""]);
  });

  it("reads a date of birth day first, as India writes it (D130), and leaves an unreadable one as it is", () => {
    expect(dayOf(new Date("1990-04-03T00:00:00Z"))).toBe("1990-04-03");
    expect(["03/04/1990", "3-4-1990", "03.04.1990", "1990-04-03", "1990-4-3"].map(dayOf)).toEqual(
      Array(5).fill("1990-04-03"),
    );
    expect(["3 Apr 1990", "03-April-1990", "3 apr, 1990"].map(dayOf)).toEqual(Array(3).fill("1990-04-03"));
    expect(["31/02/1990", "3 Foo 1990", "1990", "3/4/90", ""].map(dayOf)).toEqual([
      "31/02/1990",
      "3 Foo 1990",
      "1990",
      "3/4/90",
      "",
    ]);
  });

  it("reads an age with or without its unit, and a gender by its word", () => {
    expect(["34", "34 y", "34 yrs", "34 Years", "34yr.", 34].map(yearsOf)).toEqual(Array(6).fill("34"));
    expect(yearsOf("about 34")).toBe("about 34");
    expect(["M", "male", "F", "Female", "o", "Other"].map(genderOf)).toEqual([
      "MALE",
      "MALE",
      "FEMALE",
      "FEMALE",
      "OTHER",
      "OTHER",
    ]);
    expect(genderOf("x")).toBe("x");
  });
});

const sheet = (
  rows: (string | number | null)[][],
  headers = ["Name", "Mobile", "DOB", "Age", "Gender"],
): ImportSheet => ({
  name: "patients.csv",
  headers,
  rows: rows.map((cells, index) => ({ line: index + 2, cells })),
});
let keys = 0;
const nextKey = () => `00000000-0000-4000-8000-${String(++keys).padStart(12, "0")}`;

describe("checkRows (plan §10.5)", () => {
  it("makes each row a patient as the add sheet would, under its own key", () => {
    const [row] = checkRows(
      sheet([["Rohan Mehta", "98765 43210", "03/04/1990", "", "M"]]),
      guessColumns(["Name", "Mobile", "DOB", "Age", "Gender"]),
      nextKey,
    );
    expect(row).toMatchObject({
      line: 2,
      name: "Rohan Mehta",
      phone: "+919876543210",
      problems: [],
      input: {
        fullName: "Rohan Mehta",
        phone: "98765 43210",
        born: { as: "DATE", date: "1990-04-03" },
        gender: "MALE",
      },
    });
    expect(row.key).toMatch(/^0{8}-/);
  });

  it("takes the age when there is no date of birth, and the date when there are both", () => {
    const map = guessColumns(["Name", "Mobile", "DOB", "Age", "Gender"]);
    const [aged, both] = checkRows(
      sheet([
        ["Asha", "9876543211", "", "41 yrs", "F"],
        ["Ravi", "9876543212", "1990-04-03", "12", "M"],
      ]),
      map,
    );
    expect(aged.input?.born).toEqual({ as: "AGE", years: "41" });
    expect(both.input?.born).toEqual({ as: "DATE", date: "1990-04-03" });
  });

  it("says what each refused row needs, as a file is fixed", () => {
    const map = guessColumns(["Name", "Mobile", "DOB", "Age", "Gender"]);
    const [noName, badDate, badGender, noBirth] = checkRows(
      sheet([
        ["", "12345", "03/04/1990", "", "M"],
        ["Kiran", "9876543210", "31/02/1990", "", "M"],
        ["Leela", "9876543210", "03/04/1990", "", "x"],
        ["Mira", "9876543210", "", "", "F"],
      ]),
      map,
    );
    expect(noName).toMatchObject({
      input: null,
      phone: null,
      problems: ["Full name needs a value.", expect.any(String)],
    });
    expect(badDate.problems).toEqual(["Date of birth must be a date, like 03/04/1990 (day first) or 1990-04-03."]);
    expect(badGender.problems).toEqual(["Gender needs to say Male, Female or Other (or M, F, O)."]);
    expect(noBirth.problems).toEqual(["Date of birth needs a value."]);
    const [future] = checkRows(sheet([["Neel", "9876543210", "03/04/2030", "", "M"]]), map);
    expect(future.problems).toEqual([expect.stringMatching(/./)]);
    expect(future.problems[0]).not.toContain("like 03/04/1990");
  });

  it("asks for the age when only an age column was chosen", () => {
    const map = guessColumns(["Name", "Mobile", "Age", "Gender"]);
    const [row] = checkRows(sheet([["Om", "9876543210", "", "M"]], ["Name", "Mobile", "Age", "Gender"]), map);
    expect(row.problems).toEqual(["Age in years needs a value."]);
  });
});

describe("similarNames (D129)", () => {
  it("takes every word of the shorter name in the longer as one person, a family's names as two", () => {
    expect(similarNames("Rohan Mehta", "rohan  MEHTA")).toBe(true);
    expect(similarNames("Rohan Mehta", "Mr. Rohan K. Mehta")).toBe(true);
    expect(similarNames("Rohan", "Rohan Mehta")).toBe(true);
    expect(similarNames("Rohan Mehta", "Riya Mehta")).toBe(false);
    expect(similarNames("", "Rohan")).toBe(false);
  });
});

describe("findDuplicates (D129)", () => {
  const ready = (line: number, name: string, phone: string | null, input = true): CheckedRow => ({
    line,
    cells: [],
    key: String(line),
    input: input ? ({} as CheckedRow["input"]) : null,
    name,
    phone,
    problems: [],
  });

  it("flags a ready row on a patient's mobile with a similar name, or on an earlier row's, keeping the first", () => {
    const rows = [
      ready(2, "Rohan Mehta", "+919876543210"),
      ready(3, "Riya Mehta", "+919876543210"),
      ready(4, "Rohan Mehta", "+919876543210"),
      ready(5, "Asha Rao", "+919811111111"),
      ready(6, "Asha Rao", "+919822222222"),
      ready(7, "Bad Row", null, false),
    ];
    const duplicates = findDuplicates(rows, [
      { phone: "+919811111111", number: 1012, name: "Asha  Rao" },
      { phone: "+919811111111", number: 1013, name: "Bina Rao" },
    ]);
    expect([...duplicates]).toEqual([
      [4, { kind: "ROW", line: 2 }],
      [5, { kind: "PATIENT", number: 1012, name: "Asha  Rao" }],
    ]);
  });
});
