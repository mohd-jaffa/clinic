import { describe, expect, it } from "vitest";

import { refusedCsv } from "@/features/patients/import-refused";

describe("refusedCsv (plan §10.5, D133)", () => {
  it("writes the rows back under the file's own headers, a lettered one where it had none, with why", () => {
    const text = refusedCsv(
      {
        name: "patients.xlsx",
        headers: ["Name", "Mobile", "", "DOB"],
        rows: [],
      },
      [
        {
          cells: ["Mehta, Rohan", 12345, null, new Date("1990-04-03T00:00:00Z")],
          problem: "Mobile number must be real.",
        },
        { cells: ["Asha"], problem: "Gender needs to say Male, Female or Other." },
      ],
    );
    expect(text.split("\r\n")).toEqual([
      "Name,Mobile,C,DOB,Problem",
      '"Mehta, Rohan",12345,,1990-04-03,Mobile number must be real.',
      'Asha,,,,"Gender needs to say Male, Female or Other."',
    ]);
  });
});
