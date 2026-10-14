import type { PdfFace } from "./fonts";

/**
 * Where everything on a document goes, worked out before anything is drawn
 * (plan §33): a list of what to paint, in points on A5's width, from the
 * top. Ported from Brio's bill layout. The renderer pages it and scales it
 * to the clinic's paper, so one layout serves A4 and A5 alike.
 */

/** How wide a run of text is in a face at a size — pdfkit's own reading. */
export type Measure = (text: string, face: PdfFace, size: number) => number;

/** What a document is printed in: black and grey only (D220). */
export type PdfColor = "ink" | "muted" | "rule";

export interface TextStyle {
  face: PdfFace;
  size: number;
  color: PdfColor;
}

export type PdfOp =
  /** `y` is the baseline. */
  | { kind: "text"; x: number; y: number; text: string; face: PdfFace; size: number; color: PdfColor }
  | { kind: "rule"; x: number; y: number; width: number; weight: number; color: PdfColor }
  /** The clinic's logo, fitted into a square. */
  | { kind: "logo"; x: number; y: number; size: number };

/** Something laid out: how tall it is, and what to paint. */
export interface PdfBlock {
  height: number;
  ops: PdfOp[];
}

export interface PdfLayout extends PdfBlock {
  /** Heights between blocks, where a page may end without cutting through a line. */
  breaks: number[];
  /** What stands at the foot of the last page — a signature — its ops from its own top. */
  foot: PdfBlock | null;
  /** A line atop every page after the first — whose it is — so a loose page is never another's. */
  running: string | null;
}

/** A line's height for text of a size. */
export const leading = (size: number) => size * 1.4;
/** Where a line's baseline sits below the top of its line. */
const baseline = (size: number) => size * 1.05;

/**
 * Breaks text into lines no wider than `width`: at the line breaks it has
 * (an address typed on several lines), then between words, and inside a word
 * only when one word alone is too wide. Given `between`, it breaks only
 * between the parts it separates — "BMI 24.4" stays whole — unless one part
 * alone is too wide.
 */
export function wrap(
  text: string,
  style: Pick<TextStyle, "face" | "size">,
  width: number,
  measure: Measure,
  between?: string,
): string[] {
  const fits = (candidate: string) => measure(candidate, style.face, style.size) <= width;
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (between !== undefined) {
      let line = "";
      for (const part of paragraph.split(between)) {
        const candidate = line ? `${line}${between}${part}` : part;
        if (fits(candidate)) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        // A part wider than the line goes by its words, and the next goes on from its last line.
        const words = wrap(part, style, width, measure);
        line = words.pop() ?? "";
        lines.push(...words);
      }
      if (line) lines.push(line);
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // A word wider than the line is cut where it must be.
      let rest = word;
      while (rest.length > 1 && !fits(rest)) {
        let cut = rest.length - 1;
        while (cut > 1 && !fits(rest.slice(0, cut))) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * A layout written from the top down, `width` wide: each call places what
 * it is given at the current height and moves down past it.
 */
export function composer(measure: Measure, width: number) {
  const ops: PdfOp[] = [];
  const breaks: number[] = [];
  let y = 0;

  const line = (text: string, style: TextStyle, x: number) =>
    ops.push({ kind: "text", x, y: y + baseline(style.size), text, ...style });

  return {
    /** How far down it has come. */
    get y() {
      return y;
    },
    width,
    measure,

    /** Text from `x`, wrapped to `wide`. */
    text(
      text: string,
      style: TextStyle,
      { x = 0, wide = width - x, between }: { x?: number; wide?: number; between?: string } = {},
    ) {
      for (const each of wrap(text, style, wide, measure, between)) {
        line(each, style, x);
        y += leading(style.size);
      }
    },

    /**
     * A lead and what follows it on one line — "Rohan Mehta · 36 y" — or,
     * when the two do not fit, the lead on its line and the rest wrapped
     * under it.
     */
    pair(
      lead: { text: string; style: TextStyle },
      rest: { text: string; style: TextStyle },
      { x = 0, gap = 4 }: { x?: number; gap?: number } = {},
    ) {
      const leadWidth = measure(lead.text, lead.style.face, lead.style.size);
      const restWidth = measure(rest.text, rest.style.face, rest.style.size);
      const size = Math.max(lead.style.size, rest.style.size);
      if (leadWidth + gap + restWidth <= width - x) {
        ops.push({ kind: "text", x, y: y + baseline(size), text: lead.text, ...lead.style });
        ops.push({ kind: "text", x: x + leadWidth + gap, y: y + baseline(size), text: rest.text, ...rest.style });
        y += leading(size);
        return;
      }
      this.text(lead.text, lead.style, { x });
      this.text(rest.text, rest.style, { x });
    },

    /** Text on the left and text set to the right edge, on one baseline; the left wraps clear of the right. */
    row(left: { text: string; style: TextStyle }, right: { text: string; style: TextStyle }) {
      const rightWidth = measure(right.text, right.style.face, right.style.size);
      const top = y;
      ops.push({
        kind: "text",
        x: width - rightWidth,
        y: top + baseline(left.style.size),
        text: right.text,
        ...right.style,
      });
      this.text(left.text, left.style, { wide: width - rightWidth - 12 });
      y = Math.max(y, top + leading(right.style.size));
    },

    /** One line at the current height, without moving down: a number beside its line, a name set to the right. */
    mark(text: string, style: TextStyle, { x = 0, right = false }: { x?: number; right?: boolean } = {}) {
      line(text, style, right ? width - measure(text, style.face, style.size) : x);
    },

    rule({
      x = 0,
      wide = width,
      color = "rule",
      weight = 0.6,
    }: Partial<{ x: number; wide: number; color: PdfColor; weight: number }> = {}) {
      ops.push({ kind: "rule", x, y, width: wide, weight, color });
    },

    logo(x: number, size: number) {
      ops.push({ kind: "logo", x, y, size });
    },

    space(height: number) {
      y += height;
    },

    /** Moves down to `to`, should it be lower than where it is. */
    reach(to: number) {
      y = Math.max(y, to);
    },

    /** A page may end here. */
    mayBreak() {
      breaks.push(y);
    },

    /** What was laid out. */
    done(): PdfBlock & { breaks: number[] } {
      return { height: y, ops, breaks };
    },
  };
}

export type Composer = ReturnType<typeof composer>;
