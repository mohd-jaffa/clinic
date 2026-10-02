import { afterEach, describe, expect, it } from "vitest";

import { UI_TEXT } from "@/constants/messages";
import {
  CHOSEN_THEME_COLOR,
  THEME_BOOT_SCRIPT,
  THEME_COLORS,
  THEME_PREFERENCE_LABELS,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  toThemePreference,
} from "@/lib/theme/themes";

/** The head as Next draws it: a toolbar colour per device theme. */
function nextHead() {
  document.head.innerHTML = `
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="${THEME_COLORS.light}">
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="${THEME_COLORS.dark}">`;
}

/** Each toolbar colour in order: its media, or "chosen", and its colour. */
const toolbars = () =>
  [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) => [
    meta.hasAttribute(CHOSEN_THEME_COLOR) ? "chosen" : meta.getAttribute("media"),
    meta.getAttribute("content"),
  ]);

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.head.innerHTML = "";
});

describe("the theme preferences (D36)", () => {
  it("are System, Light and Dark, in the catalogue's words", () => {
    expect(THEME_PREFERENCES).toEqual(["system", "light", "dark"]);
    expect(THEME_PREFERENCE_LABELS).toEqual({
      system: UI_TEXT.theme.system,
      light: UI_TEXT.theme.light,
      dark: UI_TEXT.theme.dark,
    });
  });

  it("read anything unknown or missing as System", () => {
    expect(toThemePreference("dark")).toBe("dark");
    expect(toThemePreference("light")).toBe("light");
    expect(toThemePreference("golden")).toBe("system");
    expect(toThemePreference(null)).toBe("system");
    expect(toThemePreference(undefined)).toBe("system");
  });
});

describe("THEME_BOOT_SCRIPT", () => {
  const boot = () => new Function(THEME_BOOT_SCRIPT)();

  it("applies a stored Dark to the page, and puts its toolbar colour first, leaving Next's as they are", () => {
    nextHead();
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    boot();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(toolbars()).toEqual([
      ["chosen", THEME_COLORS.dark],
      ["(prefers-color-scheme: light)", THEME_COLORS.light],
      ["(prefers-color-scheme: dark)", THEME_COLORS.dark],
    ]);
  });

  it("leaves the device to decide when nothing, or nothing it knows, is stored", () => {
    nextHead();
    const before = toolbars();
    boot();
    localStorage.setItem(THEME_STORAGE_KEY, "golden");
    boot();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(toolbars()).toEqual(before);
  });

  it("never stops the page when storage cannot be read", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(boot).not.toThrow();
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });
});
