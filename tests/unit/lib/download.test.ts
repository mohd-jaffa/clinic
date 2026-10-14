import { afterEach, describe, expect, it, vi } from "vitest";

import { saveCsv, saveFile } from "@/lib/download";

/** A blob's text as written, its byte-order mark kept. */
const textOf = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new TextDecoder("utf-8", { ignoreBOM: true }).decode(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });

afterEach(() => vi.restoreAllMocks());

describe("saveCsv", () => {
  it("hands the browser the file under its name, marked as UTF-8 for Excel, and lets the address go after", async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:file";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("rows.csv");
      expect(this.href).toBe("blob:file");
    });

    saveCsv("rows.csv", "Name,Problem\nRohan,No mobile");
    expect(click).toHaveBeenCalledOnce();
    // Not at once: revoking before the save starts can cancel it.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(blobs[0].type).toBe("text/csv;charset=utf-8");
    expect(await textOf(blobs[0])).toBe("﻿Name,Problem\nRohan,No mobile");
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:file"));
  });
});

describe("saveFile", () => {
  it("hands the browser a file it was given, as it is, under its name (plan §33, D223)", async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:pdf";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("Rohan Mehta - 14 Oct 2026 - Prescription.pdf");
      expect(this.href).toBe("blob:pdf");
    });
    const pdf = new Blob(["%PDF-1.3"], { type: "application/pdf" });

    saveFile(pdf, "Rohan Mehta - 14 Oct 2026 - Prescription.pdf");
    expect(click).toHaveBeenCalledOnce();
    expect(blobs).toEqual([pdf]);
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:pdf"));
  });
});
