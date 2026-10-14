import { describe, expect, it } from "vitest";

import { prescriptionFileName } from "@/features/documents/names";

describe("prescriptionFileName (D223)", () => {
  it("names the file for the patient, the visit's day, and what it is", () => {
    expect(prescriptionFileName("Rohan Mehta", "2026-10-14")).toBe("Rohan Mehta - 14 Oct 2026 - Prescription.pdf");
  });

  it("leaves out what a file system refuses", () => {
    expect(prescriptionFileName('Rohan "R/K" Mehta', "2026-10-14")).toBe(
      "Rohan R K Mehta - 14 Oct 2026 - Prescription.pdf",
    );
  });
});
