import { describe, expect, it } from "vitest";

import { billFileName, collectionsFileName, prescriptionFileName, receiptFileName } from "@/features/documents/names";

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

describe("billFileName (plan §15.5)", () => {
  it("names the file for the patient and the bill's number, its slash a dash", () => {
    expect(billFileName("Rohan Mehta", "2026-27/0042")).toBe("Rohan Mehta - Bill 2026-27-0042.pdf");
  });
});

describe("collectionsFileName (D359)", () => {
  it("names the file for the day's collections", () => {
    expect(collectionsFileName("2026-10-27")).toBe("Collections - 27 Oct 2026.pdf");
  });
});

describe("receiptFileName (D392)", () => {
  it("names a receipt by its number, its slashes dashes", () => {
    expect(receiptFileName("R/2026-27/0001")).toBe("Receipt R-2026-27-0001.pdf");
  });
});
