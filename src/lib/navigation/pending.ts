/**
 * Whether the app is on its way to another screen, for the shell's skeleton
 * (plan §32.1: the land draws first, ported from Brio). A navigation that
 * arrives quickly shows nothing in between; one still on its way after
 * `SLOW_MS` shows the skeleton in the screen's place, the navigation kept,
 * rather than a screen-wide loader. Kept outside React, so a link anywhere,
 * or a push from a row, can say a navigation has begun.
 */
export type NavigationState = "idle" | "starting" | "slow";

/** How long a navigation may take before the skeleton shows. */
export const SLOW_MS = 150;
/** A navigation that never lands — cancelled, or failed — stops waiting after this. */
export const GIVE_UP_MS = 15_000;

let state: NavigationState = "idle";
let slowTimer: ReturnType<typeof setTimeout> | undefined;
let giveUpTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(next: NavigationState) {
  if (state === next) return;
  state = next;
  for (const listener of listeners) listener();
}

/** A navigation to another screen has begun. */
export function startNavigation() {
  if (state !== "idle") return;
  set("starting");
  slowTimer = setTimeout(() => set("slow"), SLOW_MS);
  giveUpTimer = setTimeout(settleNavigation, GIVE_UP_MS);
}

/** The screen has arrived, or the navigation is over. */
export function settleNavigation() {
  clearTimeout(slowTimer);
  clearTimeout(giveUpTimer);
  set("idle");
}

export function readNavigation(): NavigationState {
  return state;
}

export function subscribeNavigation(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
