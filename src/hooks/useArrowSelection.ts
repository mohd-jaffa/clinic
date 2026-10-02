"use client";

import { useRef, type KeyboardEvent } from "react";

const FORWARD = new Set(["ArrowRight", "ArrowDown"]);
const BACK = new Set(["ArrowLeft", "ArrowUp"]);

/**
 * The keyboard for a row of choices where one is chosen — a radio group, a set
 * of tabs (WAI-ARIA APG): only the chosen one is in the Tab order, the arrow
 * keys choose the next or the previous (wrapping round), Home and End the
 * first and the last, and focus follows the choice.
 */
export function useArrowSelection<T extends string>(values: readonly T[], value: T, onChange: (next: T) => void) {
  const nodes = useRef(new Map<T, HTMLElement>());
  // With nothing chosen, the first is the way in.
  const current = values.includes(value) ? value : values[0];

  const onKeyDown = (event: KeyboardEvent) => {
    const index = values.indexOf(current);
    const last = values.length - 1;
    let next: number;
    if (FORWARD.has(event.key)) next = index === last ? 0 : index + 1;
    else if (BACK.has(event.key)) next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    const chosen = values[next];
    onChange(chosen);
    nodes.current.get(chosen)?.focus();
  };

  const register = (option: T) => (node: HTMLElement | null) => {
    if (node) nodes.current.set(option, node);
    else nodes.current.delete(option);
  };

  return { onKeyDown, register, tabIndex: (option: T) => (option === current ? 0 : -1) };
}
