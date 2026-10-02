import { UI_TEXT } from "@/constants/messages";

/**
 * How the app is drawn (D36): as the device is set, or always light or always
 * dark. The choice is kept per device, in this browser's storage: it is a
 * preference of the screen in front of someone, not of their account, and it
 * holds nothing about anyone. Kept apart from the provider so the root layout
 * — a Server Component — can build the pre-paint script from the same values.
 */
export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** A theme the app is actually drawn in. */
export type Theme = Exclude<ThemePreference, "system">;

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export const THEME_PREFERENCE_LABELS: Record<ThemePreference, string> = {
  system: UI_TEXT.theme.system,
  light: UI_TEXT.theme.light,
  dark: UI_TEXT.theme.dark,
};

/**
 * The browser toolbar and the Android status bar take the page's ground, in
 * each theme: `--ground` in src/app/globals.css, kept equal by a test.
 */
export const THEME_COLORS: Record<Theme, string> = {
  light: "#eef3ee",
  dark: "#0d1813",
};

export const THEME_STORAGE_KEY = "app_theme";

export function toThemePreference(value: string | null | undefined): ThemePreference {
  return (THEME_PREFERENCES as readonly string[]).includes(value ?? "")
    ? (value as ThemePreference)
    : DEFAULT_THEME_PREFERENCE;
}

/**
 * The attribute of the one theme-color meta that carries a person's own
 * choice. Next renders a meta per device theme, each with its media query;
 * the chosen one has none and goes first in <head>, and a browser takes the
 * first that matches. Next's own are never changed: React would take a
 * changed one for a new one and add another after hydration.
 */
export const CHOSEN_THEME_COLOR = "data-theme-choice";

/**
 * Runs in <head> before the first paint, so someone who chose Dark on a light
 * device never sees a light flash first (plan §32.2): it applies a stored
 * Light or Dark to <html>, and puts the chosen toolbar colour first. System
 * needs nothing — the stylesheet and Next's metas follow the device. It
 * mirrors toThemePreference and cannot import it: it is a string.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var c=${JSON.stringify(THEME_COLORS)};if(t!=="light"&&t!=="dark")return;document.documentElement.setAttribute("data-theme",t);var m=document.createElement("meta");m.setAttribute("name","theme-color");m.setAttribute("content",c[t]);m.setAttribute(${JSON.stringify(
  CHOSEN_THEME_COLOR,
)},"");document.head.prepend(m);}catch(e){}})();`;
