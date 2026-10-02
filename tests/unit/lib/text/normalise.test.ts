import { describe, expect, it } from "vitest";

import { normaliseLine, normaliseLines } from "@/lib/text/normalise";

describe("normaliseLine", () => {
  it("trims, and collapses every run of whitespace into one space", () => {
    expect(normaliseLine("  Anu \t  Menon \n")).toBe("Anu Menon");
    expect(normaliseLine("Anu Menon")).toBe("Anu Menon");
  });

  it("drops the invisible characters pasted text carries", () => {
    expect(normaliseLine("﻿Anu​ ‍Menon")).toBe("Anu Menon");
  });

  it("drops control characters", () => {
    expect(normaliseLine("Anu\u0007\u001B Menon\u007F")).toBe("Anu Menon");
  });

  it("composes Unicode, so the same letters are the same text", () => {
    const decomposed = "Café"; // e + combining acute
    expect(normaliseLine(decomposed)).toBe("Café");
    expect(normaliseLine(decomposed)).toBe(normaliseLine("Café"));
  });
});

describe("normaliseLines", () => {
  it("keeps the lines, and turns Windows breaks into plain ones", () => {
    expect(normaliseLines("Flat 302\r\nSunrise Apartments\rM.G. Road")).toBe("Flat 302\nSunrise Apartments\nM.G. Road");
  });

  it("trims each line's end and the whole", () => {
    expect(normaliseLines("\n  12 Rose Street   \nKochi\t \n\n")).toBe("12 Rose Street\nKochi");
  });

  it("allows one blank line between paragraphs, never more", () => {
    expect(normaliseLines("First\n\n\n\nSecond")).toBe("First\n\nSecond");
    expect(normaliseLines("First\n\nSecond")).toBe("First\n\nSecond");
  });

  it("drops invisible and control characters but not the breaks", () => {
    expect(normaliseLines("Line​ one\u0007\nLine two")).toBe("Line one\nLine two");
  });
});
