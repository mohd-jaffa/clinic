// @vitest-environment node
// pdfkit checks its buffers against Node's own Uint8Array, which jsdom replaces.
import { inflateSync } from "node:zlib";

import PDFDocument from "pdfkit";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Measure, PdfLayout, PdfOp } from "@/lib/pdf/layout";
import { paginate, PAPER, PDF_INNER, PDF_MARGIN, PDF_WIDTH, renderPdf } from "@/lib/pdf/render";

afterEach(() => vi.restoreAllMocks());

const pages = (pdf: Buffer) => pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
/** What the pages draw: each compressed stream, opened — the fonts' among them. */
const streams = (pdf: Buffer) =>
  [...pdf.toString("latin1").matchAll(/stream\n([\s\S]*?)\nendstream/g)]
    .map(([, body]) => {
      try {
        return inflateSync(Buffer.from(body, "latin1")).toString("latin1");
      } catch {
        return "";
      }
    })
    .join("\n");
const line = (text: string, y: number): PdfOp => ({
  kind: "text",
  x: 0,
  y,
  text,
  face: "regular",
  size: 9,
  color: "ink",
});

/** A layout of `count` lines, a page may end before each tenth. */
function lines(count: number, overrides: Partial<PdfLayout> = {}): PdfLayout {
  return {
    height: count * 10,
    ops: Array.from({ length: count }, (_, index) => line(`Line ${index + 1}`, index * 10 + 8)),
    breaks: Array.from({ length: Math.floor(count / 10) }, (_, index) => (index + 1) * 100),
    foot: { height: 30, ops: [line("Dr. Maya Rao", 20)] },
    running: "Rohan Mehta · 14 Oct 2026",
    ...overrides,
  };
}

/** Draws `layout` on `paper`, and what text it drew, in order. */
async function draw(
  layout: PdfLayout,
  { paper = "A5", logo = null }: { paper?: "A4" | "A5"; logo?: Buffer | null } = {},
) {
  const text = vi.spyOn(PDFDocument.prototype, "text");
  const image = vi.spyOn(PDFDocument.prototype, "image");
  let measured: Measure | null = null;
  const pdf = await renderPdf({
    paper,
    title: "Prescription for Rohan Mehta",
    author: "Smile Care",
    logo,
    compose: (measure) => {
      measured = measure;
      return layout;
    },
  });
  return {
    pdf,
    raw: pdf.toString("latin1"),
    drawn: text.mock.calls.map(([words]) => words),
    image,
    measured: measured!,
  };
}

describe("paginate", () => {
  it("ends each page at the last break that fits", () => {
    expect(paginate({ height: 1000, breaks: [300, 450, 700, 900] }, 500)).toEqual([
      [0, 450],
      [450, 900],
      [900, 1000],
    ]);
  });

  it("gives the later pages their own room", () => {
    expect(paginate({ height: 1000, breaks: [300, 450, 700, 900] }, 500, 300)).toEqual([
      [0, 450],
      [450, 700],
      [700, 1000],
    ]);
  });

  it("cuts where the page ends when no break fits, and is one page when all of it does — or nothing is there", () => {
    expect(paginate({ height: 900, breaks: [] }, 500)).toEqual([
      [0, 500],
      [500, 900],
    ]);
    expect(paginate({ height: 400, breaks: [200] }, 500)).toEqual([[0, 400]]);
    expect(paginate({ height: 0, breaks: [] }, 500)).toEqual([[0, 0]]);
  });
});

describe("renderPdf (plan §33; D28, D30, D218 – D220)", () => {
  it("lays out on A5's width, within its margins", () => {
    expect(PAPER).toEqual({ A4: { width: 595.28, height: 841.89 }, A5: { width: 419.53, height: 595.28 } });
    expect(PDF_WIDTH).toBe(419.53);
    expect(PDF_MARGIN).toBe(30);
    expect(PDF_INNER).toBeCloseTo(359.53);
  });

  it("is an A5 PDF on one page, in the app's own faces, with its foot and the app's credit, and no page number", async () => {
    const { raw, drawn, measured, image } = await draw(
      lines(3, {
        ops: [
          { kind: "logo", x: 0, y: 0, size: 44 },
          ...lines(3).ops,
          { kind: "rule", x: 0, y: 25, width: 100, weight: 0.6, color: "rule" },
        ],
      }),
    );
    expect(raw.startsWith("%PDF")).toBe(true);
    expect(raw).toContain("/MediaBox [0 0 419.53 595.28]");
    expect(raw).toContain("Figtree");
    expect(raw).not.toContain("Helvetica");
    for (const said of ["(ClinicDesk)", "(Prescription for Rohan Mehta)", "(Smile Care)"]) expect(raw).toContain(said);
    expect(pages(Buffer.from(raw, "latin1"))).toBe(1);
    // The body, the signature at the foot, the credit; one page needs no running line, nor a number.
    expect(drawn).toEqual(["Line 1", "Line 2", "Line 3", "Dr. Maya Rao", "Generated with ClinicDesk"]);
    // A clinic with no logo has none drawn where it would go.
    expect(image).not.toHaveBeenCalled();
    // It measured in pdfkit's own faces: bold is wider.
    expect(measured("Paracetamol", "bold", 10)).toBeGreaterThan(measured("Paracetamol", "regular", 10));
  });

  it("scales the same layout up to A4", async () => {
    const { pdf } = await draw(lines(3));
    const { pdf: a4 } = await draw(lines(3), { paper: "A4" });
    expect(pdf.toString("latin1")).toContain("/MediaBox [0 0 419.53 595.28]");
    expect(streams(pdf)).not.toContain(" cm\n1.418921");
    expect(streams(pdf)).not.toContain("1.418921 0 0 1.418921");
    expect(a4.toString("latin1")).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(streams(a4)).toContain("q\n1.418921 0 0 1.418921 0 0 cm");
  });

  it("runs a long one on to more pages, between its breaks, each later page headed and every page numbered", async () => {
    const { pdf, drawn } = await draw(lines(120));
    expect(pages(pdf)).toBe(3);
    const body = drawn.filter((words) => /^Line \d+$/.test(String(words)));
    // Every line once, in order.
    expect(body).toEqual(Array.from({ length: 120 }, (_, index) => `Line ${index + 1}`));
    expect(drawn.filter((words) => words === "Rohan Mehta · 14 Oct 2026")).toHaveLength(2);
    expect(drawn.filter((words) => String(words).startsWith("Page "))).toEqual([
      "Page 1 of 3",
      "Page 2 of 3",
      "Page 3 of 3",
    ]);
    expect(drawn.filter((words) => words === "Dr. Maya Rao")).toHaveLength(1);
    // The first page ends at a break, after line 50; the next starts with its running line.
    expect(drawn.slice(drawn.indexOf("Line 50"), drawn.indexOf("Line 51") + 1)).toEqual([
      "Line 50",
      "Generated with ClinicDesk",
      "Page 1 of 3",
      "Rohan Mehta · 14 Oct 2026",
      "Line 51",
    ]);
  });

  it("puts the foot on a page of its own when the last page has no room left for it", async () => {
    const full = lines(52, { breaks: [], running: null });
    const { pdf, drawn } = await draw(full);
    expect(pages(pdf)).toBe(2);
    expect(drawn.slice(-4)).toEqual(["Page 1 of 2", "Dr. Maya Rao", "Generated with ClinicDesk", "Page 2 of 2"]);
    // No running line was asked for.
    expect(drawn.filter((words) => String(words).startsWith("Rohan"))).toEqual([]);
  });

  it("puts the foot on a later page of its own too, the running line atop it", async () => {
    const { pdf, drawn } = await draw(lines(100, { breaks: [500, 990] }));
    expect(pages(pdf)).toBe(3);
    expect(drawn.slice(-5)).toEqual([
      "Page 2 of 3",
      "Rohan Mehta · 14 Oct 2026",
      "Dr. Maya Rao",
      "Generated with ClinicDesk",
      "Page 3 of 3",
    ]);
  });

  it("sets a stamp across every page, slanted and faint, under the footer (D315)", async () => {
    const rotate = vi.spyOn(PDFDocument.prototype, "rotate");
    const opacity = vi.spyOn(PDFDocument.prototype, "fillOpacity");
    const { drawn } = await draw(lines(120, { stamp: "VOID" }));
    expect(drawn.filter((words) => words === "VOID")).toHaveLength(3);
    expect(rotate).toHaveBeenCalledTimes(3);
    expect(rotate.mock.calls[0][0]).toBe(-30);
    expect(opacity).toHaveBeenCalledWith(0.18);
    // Each page's stamp, then its footer.
    expect(drawn.slice(drawn.lastIndexOf("VOID"))).toEqual(["VOID", "Generated with ClinicDesk", "Page 3 of 3"]);
  });

  it("draws the logo it is given, and needs no foot", async () => {
    const logo = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#1c6a44" } })
      .png()
      .toBuffer();
    const { raw, image, drawn } = await draw(
      { height: 50, ops: [{ kind: "logo", x: 0, y: 0, size: 44 }], breaks: [], foot: null, running: null },
      { logo },
    );
    expect(raw).toContain("/Subtype /Image");
    expect(image).toHaveBeenCalledOnce();
    expect(drawn).toEqual(["Generated with ClinicDesk"]);
  });
});
