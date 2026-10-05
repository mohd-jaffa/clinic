import { describe, expect, it } from "vitest";

import { columnLetter, guessColumns, missingColumns } from "@/features/patients/import-columns";

describe("guessColumns (plan §10.5)", () => {
  it("matches each field to the header that names it, however it is written", () => {
    expect(
      guessColumns(["Patient Name", "Mobile No.", "D.O.B", "Sex", "E-mail ID", "Address", "Remarks", "Age"]),
    ).toEqual({
      fullName: 0,
      phone: 1,
      dateOfBirth: 2,
      age: 7,
      gender: 3,
      altPhone: null,
      email: 4,
      address: 5,
      emergencyContactName: null,
      emergencyContactPhone: null,
      notes: 6,
    });
  });

  it("gives a header holding a longer word to the most particular field first", () => {
    const map = guessColumns(["Emergency Contact Phone", "Patient's mobile number", "Full name of patient", "Gender"]);
    expect(map).toMatchObject({
      emergencyContactPhone: 0,
      phone: 1,
      fullName: 2,
      gender: 3,
      emergencyContactName: null,
    });
  });

  it("gives a column to one field only, and leaves unnamed or empty headers alone", () => {
    const map = guessColumns(["Name", "Name", "", "Comments column", "xyz"]);
    expect(map.fullName).toBe(0);
    expect(map.notes).toBe(3);
    expect(Object.values(map).filter((column) => column !== null)).toEqual([0, 3]);
  });
});

describe("missingColumns", () => {
  it("names the required fields not yet matched, and a birth without a date or an age", () => {
    const none = guessColumns([]);
    expect(missingColumns(none)).toEqual({ fields: ["fullName", "phone", "gender"], born: true });
    expect(missingColumns({ ...none, fullName: 0, phone: 1, gender: 2, age: 3 })).toEqual({ fields: [], born: false });
    expect(missingColumns({ ...none, dateOfBirth: 3 }).born).toBe(false);
  });
});

describe("columnLetter", () => {
  it("names a column as a spreadsheet does", () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetter)).toEqual([
      "A",
      "B",
      "Z",
      "AA",
      "AB",
      "AZ",
      "BA",
      "ZZ",
      "AAA",
    ]);
  });
});
