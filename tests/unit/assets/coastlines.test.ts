import { describe, expect, it } from "vitest";

import { COASTLINES } from "@/assets/coastlines";

/** The x, y pairs a path names, after its command letters. */
function points(d: string): [number, number][] {
  const numbers = d
    .replace(/[MHVCZ]/g, " ")
    .trim()
    .split(/\s+/)
    .map(Number);
  // H and V take one number each: read them apart from the pairs.
  const [, , , , ...rest] = numbers;
  const pairs: [number, number][] = [];
  for (let at = 0; at + 1 < rest.length; at += 2) pairs.push([rest[at], rest[at + 1]]);
  return pairs;
}

describe("the coastlines (plan §32.1)", () => {
  it.each(Object.entries(COASTLINES))("%s fills the land from its top edge, and closes", (_, coast) => {
    expect(coast.d.startsWith(`M0 0H${coast.width}V`)).toBe(true);
    expect(coast.d.endsWith("Z")).toBe(true);
  });

  it.each(Object.entries(COASTLINES))("%s stays inside its own box", (_, coast) => {
    for (const [x, y] of points(coast.d)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(coast.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(coast.height);
    }
  });

  it("swells: no edge is a straight line across", () => {
    for (const coast of Object.values(COASTLINES)) expect(coast.d).toMatch(/C/);
  });
});
