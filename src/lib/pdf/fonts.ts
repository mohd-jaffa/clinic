import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The faces every PDF is drawn in (plan §33): the app's own Figtree, as
 * static TrueType in `public/fonts/pdf` (scripts/pdf-fonts.mjs) — Latin with
 * Latin Extended and ₹; other scripts come later (D224). Read from disk once
 * a process; next.config.ts traces them into the routes that draw.
 */
export type PdfFace = "regular" | "semibold" | "bold";

export const PDF_FONT_DIRECTORY = join("public", "fonts", "pdf");

export const PDF_FONT_FILES: Record<PdfFace, string> = {
  regular: "Figtree-Regular.ttf",
  semibold: "Figtree-SemiBold.ttf",
  bold: "Figtree-Bold.ttf",
};

export const PDF_FACES = Object.keys(PDF_FONT_FILES) as PdfFace[];

let fonts: Promise<Record<PdfFace, Buffer>> | null = null;

/** The faces' files, read once; a failed read is tried again by the next PDF. */
export function loadPdfFonts(): Promise<Record<PdfFace, Buffer>> {
  fonts ??= Promise.all(
    PDF_FACES.map((face) => readFile(join(process.cwd(), PDF_FONT_DIRECTORY, PDF_FONT_FILES[face]))),
  ).then(
    (files) => Object.fromEntries(PDF_FACES.map((face, index) => [face, files[index]])) as Record<PdfFace, Buffer>,
    (failure: unknown) => {
      fonts = null;
      throw failure;
    },
  );
  return fonts;
}

/** Only for tests: forgets the faces, as a new process would. */
export function resetPdfFonts() {
  fonts = null;
}
