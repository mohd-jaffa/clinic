import type { ReactNode } from "react";

import { COASTLINES, type CoastlineName } from "@/assets/coastlines";

import { cn } from "./cn";

/**
 * One coastline drawn (plan §32.1): the land's softly swelling edge, from the
 * authored paths in `src/assets/coastlines.ts`, stretched along the edge with
 * its depth kept — across, for land above the ground, or down, for an upright
 * one beside it. `flip` turns it over, for land that rises from below — the
 * Quick Actions lobe.
 */
export function Coastline({ name, flip = false }: { name: CoastlineName; flip?: boolean }) {
  const { width, height, d } = COASTLINES[name];
  const upright = height > width;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("block fill-land", upright ? "h-full" : "w-full", flip && "-scale-y-100")}
      style={upright ? { width } : { height }}
    >
      <path d={d} />
    </svg>
  );
}

/**
 * The land that leads a screen (plan §32.1): one flat field of clinic green
 * holding the screen's one key fact, its lower edge a coastline, never a
 * straight card edge. A lead screen's land is generous; a dense one keeps the
 * slim `band`. `pin` is pinned on the coastline at the right — the one thing
 * not to miss (`Pin`). What sits on the land takes its colours: land-ink, and
 * land-muted for the quieter words. It leads the screen, so it pays the top
 * safe area — the status bar of a phone drawn edge to edge.
 */
export function CoastHeader({
  size = "lead",
  pin,
  children,
}: {
  size?: "lead" | "band";
  pin?: ReactNode;
  children: ReactNode;
}) {
  const lead = size === "lead";
  return (
    <div className="relative">
      <div
        className={cn(
          "safe-top bg-land px-4 pb-2 text-land-ink md:px-8",
          lead ? "[--safe-pt:1.25rem] md:[--safe-pt:2rem]" : "[--safe-pt:0.5rem]",
        )}
      >
        {children}
      </div>
      <div className="relative">
        {lead ? (
          <>
            <div className="md:hidden">
              <Coastline name="phone" />
            </div>
            <div className="hidden md:block">
              <Coastline name="wide" />
            </div>
          </>
        ) : (
          <Coastline name="band" />
        )}
        {pin && <div className={cn("absolute right-4 max-w-[60%] md:right-8", lead ? "top-1" : "-top-2.5")}>{pin}</div>}
      </div>
    </div>
  );
}
