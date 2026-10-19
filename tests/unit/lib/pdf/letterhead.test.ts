import { describe, expect, it } from "vitest";

import { composer, type Measure, type PdfOp } from "@/lib/pdf/layout";
import { layoutLetterhead, type Letterhead } from "@/lib/pdf/letterhead";

const measure: Measure = (text, _face, size) => text.length * size * 0.5;
const CLINIC: Letterhead = {
  name: "Smile Care",
  address: "12 MG Road\n\nPanampilly Nagar ",
  city: "Kochi",
  phone: "0484 234 5678",
  logo: true,
};
const texts = (ops: PdfOp[]) => ops.flatMap((op) => (op.kind === "text" ? [[op.text, op.x, op.face]] : []));

describe("layoutLetterhead (plan §33, D218)", () => {
  it("sets the logo on the left, and the name, the address with its city and the phone beside it, then an ink rule", () => {
    const page = composer(measure, 360);
    layoutLetterhead(page, CLINIC);
    const { ops, height } = page.done();
    expect(ops[0]).toEqual({ kind: "logo", x: 0, y: 0, size: 44 });
    expect(texts(ops)).toEqual([
      ["Smile Care", 56, "bold"],
      ["12 MG Road, Panampilly Nagar, Kochi", 56, "regular"],
      ["0484 234 5678", 56, "regular"],
    ]);
    // Under the words, taller here than the logo, and a little clear of them.
    expect(ops.at(-1)).toMatchObject({ kind: "rule", x: 0, width: 360, weight: 0.8, color: "ink" });
    expect(height).toBeCloseTo(15 * 1.4 + 1 + 8 * 1.4 * 2 + 10);
  });

  it("goes down past the logo when the words are shorter than it", () => {
    const page = composer(measure, 360);
    layoutLetterhead(page, { ...CLINIC, phone: null });
    expect(page.done().height).toBe(44 + 10);
  });

  it("gives the GSTIN under the phone, when there is one (plan §15.5)", () => {
    const page = composer(measure, 360);
    layoutLetterhead(page, { ...CLINIC, gstin: "32ABCDE1234F1Z5" });
    expect(texts(page.done().ops).at(-1)).toEqual(["GSTIN 32ABCDE1234F1Z5", 56, "regular"]);
  });

  it("starts at the left edge without a logo, and leaves out a phone it has none of", () => {
    const page = composer(measure, 360);
    page.space(5);
    layoutLetterhead(page, { ...CLINIC, logo: false, phone: null, address: "12 MG Road" });
    const { ops } = page.done();
    expect(ops.some((op) => op.kind === "logo")).toBe(false);
    expect(texts(ops)).toEqual([
      ["Smile Care", 0, "bold"],
      ["12 MG Road, Kochi", 0, "regular"],
    ]);
    const rule = ops.at(-1)!;
    // The words alone: the name's line, a point, the address's line, then the gap.
    expect(rule.y).toBeCloseTo(5 + 15 * 1.4 + 1 + 8 * 1.4 + 10);
  });
});
