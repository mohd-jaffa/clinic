"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react";

/** Kept between a panel and its control, and between the panel and the screen's edge. */
const GAP = 6;
const EDGE = 8;

/**
 * Sets an open panel against its control: under it where there is room, over
 * it where there is more, as wide as the control at least, lined up with the
 * control's nearer edge of the screen, and never past the screen's edges.
 */
export function placeAgainst(panel: HTMLElement, control: HTMLElement, maxHeight: number) {
  const box = control.getBoundingClientRect();
  const height = window.innerHeight;
  const below = height - box.bottom - GAP - EDGE;
  const above = box.top - GAP - EDGE;
  const up = below < Math.min(panel.scrollHeight, maxHeight) && above > below;

  panel.style.minWidth = `${box.width}px`;
  panel.style.maxHeight = `${Math.max(0, Math.min(maxHeight, up ? above : below))}px`;
  panel.style.top = up ? "auto" : `${box.bottom + GAP}px`;
  panel.style.bottom = up ? `${height - box.top + GAP}px` : "auto";
  const width = panel.offsetWidth;
  const start = box.left + box.width / 2 > window.innerWidth / 2 ? box.right - width : box.left;
  panel.style.left = `${Math.max(EDGE, Math.min(start, window.innerWidth - width - EDGE))}px`;
}

/**
 * A panel that opens from a control — the select's list, the date picker's
 * calendar (D65) — as a `popover="manual"`
 * element. What both owe the page lives here once:
 *
 * - **Where it opens:** in the top layer, so no sheet that scrolls can clip
 *   it, set against its control before it paints (`placeAgainst`).
 * - **It moves with its control** on a scroll or a resize — a phone's address
 *   bar folding away, a page still gliding — and once a sheet around it has
 *   finished rising, so one opened mid-rise settles under its control; but
 *   not on a scroll inside it.
 * - **A tap anywhere else** — outside the panel and the control — calls
 *   `onDismiss`.
 *
 * The panel stays in the control's part of the page, so inside a modal sheet
 * it is still reachable.
 */
export function useAnchoredPopover({
  open,
  panel,
  control,
  maxHeight,
  onDismiss,
}: {
  open: boolean;
  panel: RefObject<HTMLElement | null>;
  control: RefObject<HTMLElement | null>;
  maxHeight: number;
  onDismiss: () => void;
}) {
  const shown = useRef(false);
  const dismiss = useEffectEvent(onDismiss);

  useLayoutEffect(() => {
    const element = panel.current!;
    if (open) {
      element.showPopover();
      shown.current = true;
      placeAgainst(element, control.current!, maxHeight);
    } else if (shown.current) {
      element.hidePopover();
      shown.current = false;
    }
  }, [open, panel, control, maxHeight]);

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null, element: HTMLElement | null) =>
      target instanceof Node && Boolean(element?.contains(target));
    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target, panel.current) && !inside(event.target, control.current)) dismiss();
    };
    let frame = 0;
    const follow = (event: Event) => {
      if (inside(event.target, panel.current)) return;
      cancelAnimationFrame(frame);
      // Cancelled as it closes, so both are still there.
      frame = requestAnimationFrame(() => placeAgainst(panel.current!, control.current!, maxHeight));
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("scroll", follow, true);
    document.addEventListener("animationend", follow, true);
    document.addEventListener("transitionend", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("scroll", follow, true);
      document.removeEventListener("animationend", follow, true);
      document.removeEventListener("transitionend", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open, panel, control, maxHeight]);
}
