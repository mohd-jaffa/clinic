"use client";

import { useState } from "react";

import type { Treatment } from "../types";

/**
 * The treatment a screen has open (D256, D261): which, and whether it is
 * still showing — read afresh from the list the screen holds, so its sheet
 * follows a change saved meanwhile, and kept once it leaves that list (or the
 * sheet closes) so the sheet has something to show as it goes.
 */
export function useOpenedTreatment(treatments: readonly Treatment[]) {
  const [state, setState] = useState<{ held: Treatment | null; open: boolean }>({ held: null, open: false });
  const fresh = state.held && treatments.find((treatment) => treatment.id === state.held!.id);
  return {
    treatment: fresh ?? state.held,
    open: state.open,
    show: (treatment: Treatment) => setState({ held: treatment, open: true }),
    close: () => setState((now) => ({ ...now, open: false })),
  };
}
