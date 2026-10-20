"use client";

import { useState } from "react";

/**
 * The record a screen has open in a sheet — a payment, a visit to bill —
 * and whether it is still showing: kept once closed, so its sheet has
 * something to show as it goes.
 */
export function useOpened<T>() {
  const [state, setState] = useState<{ item: T | null; open: boolean }>({ item: null, open: false });
  return {
    item: state.item,
    open: state.open,
    show: (item: T) => setState({ item, open: true }),
    close: () => setState((now) => ({ ...now, open: false })),
  };
}
