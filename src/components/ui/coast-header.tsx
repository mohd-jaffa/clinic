import type { ReactNode } from "react";

import { COASTLINES, type CoastlineName } from "@/assets/coastlines";

import { cn } from "./cn";

/**
 * One coastline drawn (plan §32.1): the land's softly swelling edge, from the
 * authored paths in `src/assets/coastlines.ts`, stretched to its width with
 * its height kept. `flip` turns it over, for land that rises from below — the
 * Quick Actions lobe.
 */
export function Coastline({ name, flip = false }: { name: CoastlineName; flip?: boolean }) {
  const { width, height, d } = COASTLINES[name];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("block w-full fill-land", flip && "-scale-y-100")}
      style={{ height }}
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
 * land-muted for the quieter words.
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
      <div className={cn("bg-land text-land-ink", lead ? "px-4 pt-5 pb-2 md:px-8 md:pt-8" : "px-4 py-2 md:px-8")}>
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
