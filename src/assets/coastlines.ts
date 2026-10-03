/**
 * The coastlines (plan §32.1): the softly swelling lower edge of the land, a
 * few authored paths drawn once — never generated per render. Each fills the
 * land down to its edge in its own box; drawn with `preserveAspectRatio="none"`
 * it stretches to any width, and the swell keeps its height.
 */
export interface Coastline {
  width: number;
  height: number;
  d: string;
}

export const COASTLINES = {
  /** Under a page header or a lead screen's land, from a tablet up. */
  wide: {
    width: 1200,
    height: 34,
    d: "M0 0H1200V10C1130 26 1060 33 980 27C900 21 850 6 760 9C670 12 630 30 540 31C450 32 400 15 310 13C220 11 170 28 90 27C50 26 20 20 0 16Z",
  },
  /** Under a phone's lead land: one long swell, with room for a pin at the right. */
  phone: {
    width: 390,
    height: 34,
    d: "M0 0H390V12C350 28 300 33 250 25C200 17 170 8 120 14C80 19 50 31 0 26Z",
  },
  /**
   * The right edge of land that stands beside the ground rather than above it
   * — the account screens from 1024 px (D70): the wide swell, turned upright.
   */
  side: {
    width: 34,
    height: 1200,
    d: "M0 0V1200H10C26 1130 33 1060 27 980C21 900 6 850 9 760C12 670 30 630 31 540C32 450 15 400 13 310C11 220 28 170 27 90C26 50 20 20 16 0Z",
  },
  /** The slim band a dense screen keeps, and what the land flattens into on scroll. */
  band: {
    width: 1200,
    height: 12,
    d: "M0 0H1200V4C1100 10 1000 12 900 9C800 6 700 2 600 4C500 6 400 11 300 10C200 9 100 4 0 6Z",
  },
} as const satisfies Record<string, Coastline>;

export type CoastlineName = keyof typeof COASTLINES;
