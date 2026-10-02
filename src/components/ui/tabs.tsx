"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { useArrowSelection } from "@/hooks/useArrowSelection";

import { cn } from "./cn";

const tabId = (id: string, value: string) => `${id}-tab-${value}`;
const panelId = (id: string, value: string) => `${id}-panel-${value}`;

/** The underline stops short of a tab's edges by this much, each side. */
const UNDERLINE_INSET = 10;

/**
 * The underline's drawn length, stretched to each tab's by `scaleX`: it glides
 * on the compositor, never laying the page out again as a changing width would.
 */
const UNDERLINE_BASE = 100;

/** Sets the underline under the chosen tab, or hides it when none is chosen; its first place is where it starts. */
function placeUnderline(tabs: HTMLElement, underline: HTMLElement, placed: { current: boolean }) {
  const chosen = tabs.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
  underline.hidden = !chosen;
  if (!chosen) return;
  if (!placed.current) underline.style.transition = "none";
  const length = chosen.offsetWidth - 2 * UNDERLINE_INSET;
  underline.style.transform = `translateX(${chosen.offsetLeft + UNDERLINE_INSET}px) scaleX(${length / UNDERLINE_BASE})`;
  if (!placed.current) {
    // Drawn where it starts before its glide is switched back on.
    underline.getBoundingClientRect();
    underline.style.transition = "";
    placed.current = true;
  }
}

/**
 * The views of one screen — a patient's Visits, Treatments, Bills (ported
 * from Brio): underlined in ink, scrolling sideways when they do not fit,
 * each with an optional count. The WAI-ARIA tabs pattern: the arrow keys move
 * between tabs and show each as they go, and every tab names the `TabPanel`
 * it controls. One underline glides from the tab left to the one chosen, on
 * the map's one curve, measured again whenever a tab changes size.
 */
export function Tabs<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  /** Ties the tabs to their panels; unique on the screen. */
  id: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}) {
  const keys = useArrowSelection(
    options.map((option) => option.value),
    value,
    onChange,
  );
  const list = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  // After every render: the choice, or a count beside a label, may have moved it.
  useLayoutEffect(() => placeUnderline(list.current!, bar.current!, placed));

  // And whenever a tab changes size — a font that loaded, a count that grew.
  const tabs = options.map((option) => option.value).join();
  useEffect(() => {
    const element = list.current!;
    const underline = bar.current!;
    if (typeof ResizeObserver === "undefined") return;
    // Both are held from here: React lets go of its refs as the tabs leave,
    // before this effect is cleaned up, and a resize can land in between.
    const observer = new ResizeObserver(() => {
      if (element.isConnected) placeUnderline(element, underline, placed);
    });
    element.querySelectorAll('[role="tab"]').forEach((tab) => observer.observe(tab));
    return () => observer.disconnect();
  }, [tabs]);

  return (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      onKeyDown={keys.onKeyDown}
      className="relative -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] md:mx-0 md:px-0"
    >
      <span
        ref={bar}
        aria-hidden="true"
        style={{ width: UNDERLINE_BASE }}
        className="absolute bottom-0 left-0 h-[3px] origin-left rounded-full bg-chip transition-transform duration-(--duration-map) ease-map"
      />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={keys.register(option.value)}
            id={tabId(id, option.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(id, option.value)}
            tabIndex={keys.tabIndex(option.value)}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 px-3 py-3 whitespace-nowrap transition-colors",
              selected ? "font-bold text-ink" : "text-muted hover:text-ink",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-2 text-caption font-bold tabular-nums",
                  selected ? "bg-chip text-on-chip" : "bg-ground text-muted",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** What one tab shows; it is named by its tab. */
export function TabPanel({ id, value, children }: { id: string; value: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={panelId(id, value)} aria-labelledby={tabId(id, value)} tabIndex={0} className="pt-4">
      {children}
    </div>
  );
}
