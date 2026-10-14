import PDFDocument from "pdfkit";

import { UI_TEXT } from "@/constants/messages";
import type { PaperSize } from "@/constants/statuses";

import { loadPdfFonts, PDF_FACES } from "./fonts";
import type { Measure, PdfColor, PdfLayout, PdfOp } from "./layout";

/**
 * A document drawn as a PDF (plan §33): its layout, paged and scaled to the
 * clinic's paper — A4 or A5 (D28) — with the small ClinicDesk footer on
 * every page (D30). Made for the request that asks for it, returned as bytes
 * and written nowhere (AGENTS.md §19). Ported from Brio's bill PDF.
 */

/** The papers, in points. */
export const PAPER: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
};

/**
 * Every document is laid out on A5's width and scaled up to fill A4's, so
 * the one layout prints at both sizes (plan §33).
 */
export const PDF_WIDTH = PAPER.A5.width;
export const PDF_MARGIN = 30;
/** How wide a layout is: the page within its margins. */
export const PDF_INNER = PDF_WIDTH - PDF_MARGIN * 2;
/** The room under the content for the footer. */
const FOOT_ROOM = 34;
/** The least room left between the content and a signature at the page's foot. */
const FOOT_GAP = 16;

/** Black and grey only (D220): it prints the same on any printer, and photocopies. */
const COLORS: Record<PdfColor, string> = { ink: "#111111", muted: "#4a4a4a", rule: "#8a8a8a" };

/** The room atop each later page for its running line. */
const RUNNING = 20;

/**
 * Page slices of a layout: the first page `room` tall, each later one
 * `later`. Each ends at the last break that fits, or where the page does if
 * none does.
 */
export function paginate(
  layout: Pick<PdfLayout, "height" | "breaks">,
  room: number,
  later: number = room,
): [number, number][] {
  const pages: [number, number][] = [];
  let start = 0;
  do {
    let end = Math.min(layout.height, start + (pages.length === 0 ? room : later));
    if (end < layout.height) {
      const fits = layout.breaks.filter((at) => at > start && at <= end);
      if (fits.length > 0) end = Math.max(...fits);
    }
    pages.push([start, end]);
    start = end;
  } while (start < layout.height);
  return pages;
}

function paint(document: PDFKit.PDFDocument, op: PdfOp, logo: Buffer | null) {
  switch (op.kind) {
    case "text":
      document
        .font(op.face)
        .fontSize(op.size)
        .fillColor(COLORS[op.color])
        .text(op.text, op.x, op.y, { baseline: "alphabetic", lineBreak: false });
      break;
    case "rule":
      document
        .moveTo(op.x, op.y)
        .lineTo(op.x + op.width, op.y)
        .lineWidth(op.weight)
        .strokeColor(COLORS[op.color])
        .stroke();
      break;
    case "logo":
      if (logo) document.image(logo, op.x, op.y, { fit: [op.size, op.size], align: "center", valign: "center" });
      break;
  }
}

/**
 * `compose` lays the document out with pdfkit's own measure of the faces;
 * `logo` is the clinic's logo as PNG or JPEG — the two a PDF can hold — or
 * null to draw none.
 */
export async function renderPdf({
  paper,
  title,
  author,
  logo,
  compose,
}: {
  paper: PaperSize;
  title: string;
  author: string;
  logo: Buffer | null;
  compose: (measure: Measure) => PdfLayout;
}): Promise<Buffer> {
  const faces = await loadPdfFonts();
  const document = new PDFDocument({
    autoFirstPage: false,
    // No built-in font: every face is the app's own, so nothing is read from pdfkit's data folder.
    font: null as unknown as string,
    info: { Title: title, Author: author, Creator: UI_TEXT.appName },
  });
  for (const face of PDF_FACES) document.registerFont(face, faces[face]);

  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  const layout = compose((text, face, size) => document.font(face).fontSize(size).widthOfString(text));
  const size = PAPER[paper];
  const scale = size.width / PDF_WIDTH;
  const height = size.height / scale;
  const room = height - PDF_MARGIN - FOOT_ROOM;
  const top = layout.running === null ? 0 : RUNNING;
  const pages = paginate(layout, room, room - top);
  // The foot stands at the bottom of the last page — on a page of its own when there is no room left.
  const [lastStart, lastEnd] = pages.at(-1)!;
  const left = pages.length === 1 ? room : room - top;
  if (layout.foot && lastEnd - lastStart + FOOT_GAP + layout.foot.height > left) pages.push([lastEnd, lastEnd]);

  pages.forEach(([start, end], index) => {
    document.addPage({ size: [size.width, size.height], margin: 0 });
    document.save();
    document.scale(scale);
    const below = index > 0 ? top : 0;
    if (index > 0 && layout.running !== null) {
      paint(
        document,
        {
          kind: "text",
          x: PDF_MARGIN,
          y: PDF_MARGIN + 6,
          text: layout.running,
          face: "regular",
          size: 7,
          color: "muted",
        },
        null,
      );
    }
    document.save();
    document.translate(PDF_MARGIN, PDF_MARGIN + below - start);
    for (const op of layout.ops) {
      if (op.y >= start && op.y < end) paint(document, op, logo);
    }
    document.restore();
    const last = index === pages.length - 1;
    if (last && layout.foot) {
      document.save();
      document.translate(PDF_MARGIN, PDF_MARGIN + room - layout.foot.height);
      for (const op of layout.foot.ops) paint(document, op, logo);
      document.restore();
    }
    footer(document, { height, page: index + 1, of: pages.length });
    document.restore();
  });
  document.end();
  return done;
}

/** The app's credit at the foot of each page (D30), and the page's number when there are more. */
function footer(document: PDFKit.PDFDocument, { height, page, of }: { height: number; page: number; of: number }) {
  const y = height - PDF_MARGIN / 2 - 4;
  const style = { face: "regular", size: 6.5, color: "muted" } as const;
  const credit = UI_TEXT.documents.footer;
  document.font(style.face).fontSize(style.size);
  paint(
    document,
    { kind: "text", x: (PDF_WIDTH - document.widthOfString(credit)) / 2, y, text: credit, ...style },
    null,
  );
  if (of > 1) {
    const number = UI_TEXT.documents.page(page, of);
    paint(
      document,
      { kind: "text", x: PDF_WIDTH - PDF_MARGIN - document.widthOfString(number), y, text: number, ...style },
      null,
    );
  }
}
