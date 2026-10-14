import { describe, expect, it } from "vitest";

import { composer, leading, wrap, type Measure, type TextStyle } from "@/lib/pdf/layout";

/** Every character half its size wide: easy to count. */
const measure: Measure = (text, _face, size) => text.length * size * 0.5;
const STYLE: TextStyle = { face: "regular", size: 10, color: "ink" };
const BOLD: TextStyle = { face: "semibold", size: 12, color: "ink" };
/** At size 10, a character is 5 wide. */
const chars = (count: number) => count * 5;

describe("wrap", () => {
  it("keeps what fits on one line, and breaks between words where it does not", () => {
    expect(wrap("Plenty of fluids", STYLE, chars(16), measure)).toEqual(["Plenty of fluids"]);
    expect(wrap("Plenty of fluids", STYLE, chars(10), measure)).toEqual(["Plenty of", "fluids"]);
  });

  it("keeps the lines it was typed on, and drops what is only spaces", () => {
    expect(wrap("12 MG Road\nKochi", STYLE, chars(40), measure)).toEqual(["12 MG Road", "Kochi"]);
    expect(wrap("  a   b  \n   ", STYLE, chars(40), measure)).toEqual(["a b"]);
  });

  it("cuts a word wider than the line where it must", () => {
    expect(wrap("Amoxicillin", STYLE, chars(4), measure)).toEqual(["Amox", "icil", "lin"]);
    expect(wrap("Take Amoxicillin", STYLE, chars(6), measure)).toEqual(["Take", "Amoxic", "illin"]);
  });

  it("given parts, breaks only between them, so a reading stays whole", () => {
    const vitals = "BP 120/80 · Pulse 72 · BMI 24.4";
    expect(wrap(vitals, STYLE, chars(31), measure, " · ")).toEqual([vitals]);
    expect(wrap(vitals, STYLE, chars(22), measure, " · ")).toEqual(["BP 120/80 · Pulse 72", "BMI 24.4"]);
  });

  it("goes by words for a part wider than the line, and carries on from its last line", () => {
    expect(wrap("Swallow whole with water · BMI 24", STYLE, chars(14), measure, " · ")).toEqual([
      "Swallow whole",
      "with water",
      "BMI 24",
    ]);
    expect(wrap("ab · cdefghijklmnop · q", STYLE, chars(8), measure, " · ")).toEqual(["ab", "cdefghij", "klmnop", "q"]);
    expect(wrap("", STYLE, chars(8), measure, " · ")).toEqual([]);
    // A part of nothing but spaces, too wide, leaves nothing to carry on from.
    expect(wrap(`ab · ${" ".repeat(20)} · c`, STYLE, chars(8), measure, " · ")).toEqual(["ab", "c"]);
  });
});

describe("composer", () => {
  it("writes text from the top, each line on its baseline, and moves down past it", () => {
    const page = composer(measure, chars(10));
    expect(page.width).toBe(50);
    expect(page.measure).toBe(measure);
    page.text("Plenty of fluids", STYLE);
    page.text("Rest", STYLE, { x: 10 });
    expect(page.y).toBe(leading(10) * 3);
    const { ops, height } = page.done();
    expect(height).toBe(42);
    expect(ops).toEqual([
      { kind: "text", x: 0, y: 10.5, text: "Plenty of", face: "regular", size: 10, color: "ink" },
      { kind: "text", x: 0, y: 24.5, text: "fluids", face: "regular", size: 10, color: "ink" },
      { kind: "text", x: 10, y: 38.5, text: "Rest", face: "regular", size: 10, color: "ink" },
    ]);
  });

  it("wraps text to the width it is given, between the parts it is given", () => {
    const page = composer(measure, chars(40));
    page.text("BP 120/80 · Pulse 72 · BMI 24.4", STYLE, { wide: chars(22), between: " · " });
    expect(page.done().ops.map((op) => op.kind === "text" && op.text)).toEqual(["BP 120/80 · Pulse 72", "BMI 24.4"]);
  });

  it("sets a lead and what follows it on one line when both fit, the larger size setting the line", () => {
    const page = composer(measure, 200);
    page.pair({ text: "Rohan", style: BOLD }, { text: "36 y", style: STYLE }, { x: 4, gap: 6 });
    const { ops, height } = page.done();
    expect(height).toBe(leading(12));
    expect(ops).toEqual([
      { kind: "text", x: 4, y: 12 * 1.05, text: "Rohan", face: "semibold", size: 12, color: "ink" },
      { kind: "text", x: 4 + 30 + 6, y: 12 * 1.05, text: "36 y", face: "regular", size: 10, color: "ink" },
    ]);
  });

  it("puts what follows on its own lines when the two do not fit", () => {
    const page = composer(measure, chars(8));
    page.pair({ text: "Diagnosis:", style: STYLE }, { text: "Viral fever", style: STYLE });
    expect(page.done().ops.map((op) => op.kind === "text" && [op.text, op.y])).toEqual([
      ["Diagnosi", 10.5],
      ["s:", 24.5],
      ["Viral", 38.5],
      ["fever", 52.5],
    ]);
  });

  it("sets a row's right text to the edge, and wraps the left clear of it", () => {
    const page = composer(measure, 100);
    page.row({ text: "Dr. Maya Rao Menon", style: STYLE }, { text: "14 Oct", style: { ...STYLE, size: 8 } });
    const { ops, height } = page.done();
    // "14 Oct" at size 8 is 24 wide; the left has 100 − 24 − 12 = 64, 12 characters.
    expect(ops[0]).toEqual({ kind: "text", x: 76, y: 10.5, text: "14 Oct", face: "regular", size: 8, color: "ink" });
    expect(ops.slice(1).map((op) => op.kind === "text" && op.text)).toEqual(["Dr. Maya Rao", "Menon"]);
    expect(height).toBe(leading(10) * 2);
  });

  it("is as tall as the right text when the left is shorter", () => {
    const page = composer(measure, 100);
    page.row({ text: "", style: STYLE }, { text: "14 Oct", style: { ...STYLE, size: 20 } });
    expect(page.y).toBe(leading(20));
  });

  it("marks a line without moving: from x, or set to the right edge", () => {
    const page = composer(measure, 100);
    page.mark("1", STYLE);
    page.mark("2", STYLE, { x: 8 });
    page.mark("Dr. Maya", STYLE, { right: true });
    expect(page.y).toBe(0);
    expect(page.done().ops.map((op) => op.x)).toEqual([0, 8, 60]);
  });

  it("draws rules and the logo where it is, and moves by space, down to a mark, and never up", () => {
    const page = composer(measure, 100);
    page.logo(0, 44);
    page.rule();
    page.space(10);
    page.rule({ x: 20, wide: 30, color: "ink", weight: 1 });
    page.reach(50);
    page.reach(20);
    page.mayBreak();
    expect(page.done()).toEqual({
      height: 50,
      breaks: [50],
      ops: [
        { kind: "logo", x: 0, y: 0, size: 44 },
        { kind: "rule", x: 0, y: 0, width: 100, weight: 0.6, color: "rule" },
        { kind: "rule", x: 20, y: 10, width: 30, weight: 1, color: "ink" },
      ],
    });
  });
});
