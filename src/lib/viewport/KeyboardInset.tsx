"use client";

import { useEffect } from "react";

/**
 * Keeps `--keyboard-inset` equal to how much of the layout the on-screen
 * keyboard covers, so a sheet's footer can ride above it (plan §32.2). Where
 * the browser resizes the layout for the keyboard (`interactive-widget=
 * resizes-content`, Android Chrome), the visual viewport matches the layout and
 * this stays 0; where it does not (iOS Safari), this is the difference.
 */
export function KeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      root.style.setProperty("--keyboard-inset", `${Math.max(0, Math.round(covered))}px`);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);

  return null;
}
