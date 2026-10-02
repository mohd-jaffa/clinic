/**
 * What is on top of the page. A modal (`showModal`, the kit's `Modal`) sits in
 * the browser's top layer, and everything outside it is inert: drawn under
 * its backdrop, out of reach of a finger or a key, and silent to a screen
 * reader. A tap on something outside it lands on the modal's backdrop, which
 * closes a sheet. Even a popover drawn above it is inert (tested in Chromium
 * and WebKit), so what has to be seen, reached and heard over a modal — a
 * notice that closes itself (`response-card.tsx`) — is put inside it.
 *
 * Each open modal is a layer: a place for a notice and a polite live region,
 * there from the start so what is put in it is read out. The last one opened
 * is on top.
 */
export interface ModalLayer {
  /** Where a notice goes while this modal is on top. */
  notices: HTMLElement;
  /** A polite live region inside the modal. */
  status: HTMLElement;
}

let layers: readonly ModalLayer[] = [];
const listeners = new Set<() => void>();

function changed() {
  for (const listener of listeners) listener();
}

/**
 * Puts a modal's layer on top, and answers how to take it off. `Modal` does
 * both from a layout effect, so a sheet that closes as a notice appears — a
 * form that saved — is off before the notice is placed.
 */
export function openLayer(layer: ModalLayer): () => void {
  layers = [...layers, layer];
  changed();
  return () => {
    layers = layers.filter((open) => open !== layer);
    changed();
  };
}

/** The layer on top, or none when no modal is open. */
export function topLayer(): ModalLayer | undefined {
  return layers.at(-1);
}

/** Whether `notices` is where an open modal holds its notice. */
export function isOpenLayer(notices: Element | null): boolean {
  return layers.some((layer) => layer.notices === notices);
}

/** Calls `listener` whenever a modal opens or closes; answers how to stop. */
export function onLayersChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Each running animation under `node`, by what it moves and its name, with the time it has reached. */
function clocks(node: HTMLElement) {
  return node.getAnimations({ subtree: true }).map((animation) => ({
    target: (animation.effect as KeyframeEffect | null)?.target ?? null,
    name: (animation as CSSAnimation).animationName,
    time: animation.currentTime,
  }));
}

const canPop = (node: HTMLElement) => typeof node.showPopover === "function";
const popped = (node: HTMLElement) => canPop(node) && node.matches(":popover-open");

/**
 * Puts `holder` where what it holds can be seen and reached: inside the modal
 * on top, or, with none open, in the top layer itself as a popover — so it is
 * drawn above a sheet still sliding away — or on the page, where the browser
 * has no popovers. Nothing is inert while no modal is open, so the popover is
 * as reachable as the page.
 *
 * What it holds keeps its time. Taking a node out of the page, or hiding it,
 * restarts its CSS animations, so each one running is set back to the time
 * it had reached (a notice's countdown). A holder off the page, or hidden,
 * has played nothing, and simply goes in.
 */
export function raise(holder: HTMLElement) {
  const layer = topLayer();
  const host = layer?.notices ?? document.body;
  const pop = !layer && canPop(holder);
  if (holder.parentElement === host && popped(holder) === pop) return;

  const reached = holder.isConnected && typeof holder.getAnimations === "function" ? clocks(holder) : [];
  if (popped(holder)) holder.hidePopover();
  if (pop) holder.setAttribute("popover", "manual");
  else holder.removeAttribute("popover");
  host.append(holder);
  if (pop) holder.showPopover();
  if (reached.length === 0) return;
  for (const animation of holder.getAnimations({ subtree: true })) {
    const target = (animation.effect as KeyframeEffect | null)?.target ?? null;
    const name = (animation as CSSAnimation).animationName;
    const kept = reached.find((entry) => entry.target === target && entry.name === name);
    if (kept) animation.currentTime = kept.time;
  }
}

/** Takes `holder` out of the top layer once it holds nothing. */
export function lower(holder: HTMLElement) {
  if (popped(holder)) holder.hidePopover();
}
