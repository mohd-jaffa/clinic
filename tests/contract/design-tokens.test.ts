import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { THEME_COLORS } from "@/lib/theme/themes";

/**
 * The Clinic Map's colours (plan §32.1) as src/app/globals.css sets them:
 * every pair a screen draws text with meets WCAG AA in both themes, and the
 * two dark blocks — the device's and the person's choice — stay identical.
 */
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** The custom properties a CSS block declares, by name. */
function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

function blockAfter(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No block ${selector}`);
  return css.slice(start, css.indexOf("}", start));
}

const light = tokens(blockAfter(":root"));
const deviceDark = tokens(blockAfter(':root:not([data-theme="light"])'));
const chosenDark = tokens(blockAfter(':root[data-theme="dark"]'));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ["ink", "ground"],
  ["ink", "surface"],
  ["muted", "ground"],
  ["muted", "surface"],
  ["land-ink", "land"],
  ["land-muted", "land"],
  ["on-action", "action"],
  ["on-chip", "chip"],
  ["on-coral", "coral"],
  ["coral", "ground"],
  ["coral", "surface"],
];

const EDGE_PAIRS: [string, string][] = [
  ["action", "land"],
  ["action", "ground"],
  ["action", "surface"],
];

describe.each([
  ["light", light],
  ["dark", chosenDark],
])("the %s theme", (_, theme) => {
  it.each(TEXT_PAIRS)("draws %s on %s at 4.5:1 or more", (text, ground) => {
    expect(contrast(theme[text], theme[ground])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(EDGE_PAIRS)("sets a %s capsule apart from %s at 3:1 or more", (edge, ground) => {
    expect(contrast(theme[edge], theme[ground])).toBeGreaterThanOrEqual(3);
  });
});

describe("the two dark blocks", () => {
  it("are the same, so a person's Dark and a dark device look alike", () => {
    expect(deviceDark).toEqual(chosenDark);
  });

  it("redefine every colour the light theme defines", () => {
    expect(Object.keys(chosenDark).sort()).toEqual(Object.keys(light).sort());
  });
});

describe("the toolbar colours", () => {
  it("are each theme's ground", () => {
    expect(THEME_COLORS).toEqual({ light: light.ground, dark: chosenDark.ground });
  });
});

describe("the utilities", () => {
  it("clear Tailwind's own palette, faces and sizes, so a screen uses only the tokens", () => {
    expect(css).toMatch(/--color-\*: initial;/);
    expect(css).toMatch(/--font-\*: initial;/);
    expect(css).toMatch(/--text-\*: initial;/);
  });

  it("offer every colour token", () => {
    for (const name of Object.keys(light).filter((token) => token !== "shadow-tone")) {
      expect(css, name).toContain(`--color-${name}: var(--${name});`);
    }
  });
});
