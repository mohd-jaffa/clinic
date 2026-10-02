/**
 * The map's one duration (plan §32.1), for what script has to wait on: a card
 * taken off the screen once it has left. `globals.css` plays the same time as
 * `--duration-map`; a contract test keeps the two equal.
 */
export const MAP_MS = 260;

/** Whether this browser can play an animation from script; one that cannot shows every change at once. */
export function canAnimate(element: Element | null): element is Element {
  return element !== null && typeof element.animate === "function";
}
