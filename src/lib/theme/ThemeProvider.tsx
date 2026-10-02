"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

import { CHOSEN_THEME_COLOR, THEME_COLORS, THEME_STORAGE_KEY, toThemePreference, type ThemePreference } from "./themes";

/**
 * Which theme someone chose on this device (D36). The truth is the data-theme
 * attribute on <html>: the pre-paint script in the root layout sets it before
 * anything is drawn, and every colour comes from the tokens it switches
 * (src/app/globals.css); no attribute means the device decides. Ported from
 * Brio.
 *
 * React reads it through useSyncExternalStore: the server and the first client
 * render both see System, and React moves to the real value right after
 * hydration — no mismatch, and no flash, because the page already painted with
 * the attribute the script set.
 */
interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const CHANGED = "app:themechange";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

const current = (): ThemePreference => toThemePreference(document.documentElement.getAttribute("data-theme"));
const onServer = (): ThemePreference => "system";

function apply(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);

  // The chosen toolbar colour goes first in <head>; System hands it back to
  // the device's own metas (themes.ts).
  let chosen = document.head.querySelector(`meta[${CHOSEN_THEME_COLOR}]`);
  if (preference === "system") {
    chosen?.remove();
  } else {
    if (!chosen) {
      chosen = document.createElement("meta");
      chosen.setAttribute("name", "theme-color");
      chosen.setAttribute(CHOSEN_THEME_COLOR, "");
      document.head.prepend(chosen);
    }
    chosen.setAttribute("content", THEME_COLORS[preference]);
  }

  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not being able to remember the choice must not break the app.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(subscribe, current, onServer);
  const setPreference = useCallback((next: ThemePreference) => apply(next), []);

  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
