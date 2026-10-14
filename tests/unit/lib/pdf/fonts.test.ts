// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const readFile = vi.hoisted(() => vi.fn());
vi.mock("node:fs/promises", async (original) => {
  const real = await original<typeof import("node:fs/promises")>();
  readFile.mockImplementation(real.readFile);
  return { ...real, readFile };
});

import { loadPdfFonts, PDF_FACES, PDF_FONT_DIRECTORY, PDF_FONT_FILES, resetPdfFonts } from "@/lib/pdf/fonts";

afterEach(() => {
  resetPdfFonts();
  readFile.mockClear();
});

describe("the PDF's faces (plan §33, D224)", () => {
  it("are the app's own Figtree, regular, semibold and bold, from public/fonts/pdf", () => {
    expect(PDF_FACES).toEqual(["regular", "semibold", "bold"]);
    expect(PDF_FONT_FILES).toEqual({
      regular: "Figtree-Regular.ttf",
      semibold: "Figtree-SemiBold.ttf",
      bold: "Figtree-Bold.ttf",
    });
    expect(PDF_FONT_DIRECTORY).toBe("public/fonts/pdf");
  });

  it("reads each file once a process, as TrueType", async () => {
    const fonts = await loadPdfFonts();
    expect(Object.keys(fonts)).toEqual(PDF_FACES);
    // TrueType files open with 0x00010000.
    for (const face of PDF_FACES) expect(fonts[face].readUInt32BE(0)).toBe(0x00010000);
    await loadPdfFonts();
    expect(readFile).toHaveBeenCalledTimes(3);
    expect(readFile.mock.calls[0][0]).toMatch(/public\/fonts\/pdf\/Figtree-Regular\.ttf$/);
  });

  it("tries again after a failed read, and again once forgotten", async () => {
    readFile.mockRejectedValueOnce(new Error("missing"));
    await expect(loadPdfFonts()).rejects.toThrow("missing");
    await loadPdfFonts();
    resetPdfFonts();
    await loadPdfFonts();
    // The failed try — its three reads asked at once — then two whole reads.
    expect(readFile).toHaveBeenCalledTimes(9);
  });
});
