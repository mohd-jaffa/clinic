// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { workbook } = vi.hoisted(() => ({ workbook: { readSheet: vi.fn() } }));
vi.mock("read-excel-file/browser", () => workbook);

const { readImportFile } = await import("@/features/patients/import-file");

const csv = (text: string, name = "patients.csv") => new File([text], name, { type: "text/csv" });
const refusal = (file: File) =>
  readImportFile(file).then(
    () => null,
    (failure: { code: string }) => failure.code,
  );

beforeEach(() => {
  workbook.readSheet.mockReset();
});

describe("readImportFile (plan §10.5, D127)", () => {
  it("reads a CSV: its first filled row the header, every other with its line in the file", async () => {
    const sheet = await readImportFile(
      csv('﻿\n\nName,Mobile,,\n"Mehta, Rohan",98765 43210\n,,,\nAsha Rao,9876543211,x,y\n'),
    );
    expect(sheet).toEqual({
      name: "patients.csv",
      headers: ["Name", "Mobile", "", ""],
      rows: [
        { line: 4, cells: ["Mehta, Rohan", "98765 43210"] },
        { line: 6, cells: ["Asha Rao", "9876543211", "x", "y"] },
      ],
    });
  });

  it("reads an Excel workbook's first sheet, its dates and numbers as they are", async () => {
    const born = new Date("1990-04-03T00:00:00Z");
    workbook.readSheet.mockResolvedValue([
      ["Name", "Mobile", "DOB"],
      ["Rohan Mehta", 9876543210, born],
    ]);
    const file = new File(["x"], "Patients.XLSX");
    expect(await readImportFile(file)).toEqual({
      name: "Patients.XLSX",
      headers: ["Name", "Mobile", "DOB"],
      rows: [{ line: 2, cells: ["Rohan Mehta", 9876543210, born] }],
    });
    expect(workbook.readSheet).toHaveBeenCalledWith(file);
  });

  it("refuses what it cannot read, saying why", async () => {
    expect(await refusal(new File(["x"], "old.xls"))).toBe("IMPORT_FILE_XLS");
    expect(await refusal(new File(["x"], "notes.pdf"))).toBe("IMPORT_FILE_TYPE");
    workbook.readSheet.mockRejectedValueOnce(Object.assign(new Error("ole"), { code: "XLS_FILE_NOT_SUPPORTED" }));
    expect(await refusal(new File(["x"], "renamed.xlsx"))).toBe("IMPORT_FILE_XLS");
    workbook.readSheet.mockRejectedValueOnce(new Error("bad zip"));
    expect(await refusal(new File(["x"], "broken.xlsx"))).toBe("IMPORT_FILE_UNREADABLE");
  });

  it("refuses a file with no rows under its header, or nothing at all", async () => {
    expect(await refusal(csv("Name,Mobile\n\n"))).toBe("IMPORT_FILE_EMPTY");
    expect(await refusal(csv(""))).toBe("IMPORT_FILE_EMPTY");
    workbook.readSheet.mockResolvedValue([[null, ""]]);
    expect(await refusal(new File(["x"], "blank.xlsx"))).toBe("IMPORT_FILE_EMPTY");
  });

  it("reads a file that cannot be opened as unreadable", async () => {
    const file = csv("Name");
    vi.spyOn(file, "text").mockRejectedValue(new Error("gone"));
    expect(await refusal(file)).toBe("IMPORT_FILE_UNREADABLE");
  });
});
