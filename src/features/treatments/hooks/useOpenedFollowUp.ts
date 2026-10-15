"use client";

import { useState } from "react";

import type { FollowUp } from "../types";

/**
 * The follow-up a screen has open (plan §14.3): which, and whether it is still
 * showing — read afresh from the rows the screen holds, so its sheet follows
 * a contact noted meanwhile, and kept once it leaves them (booked, or
 * snoozed) so the sheet has something to show as it goes.
 */
export function useOpenedFollowUp(followUps: readonly FollowUp[]) {
  const [state, setState] = useState<{ held: FollowUp | null; open: boolean }>({ held: null, open: false });
  const fresh = state.held && followUps.find((followUp) => followUp.id === state.held!.id);
  return {
    followUp: fresh ?? state.held,
    open: state.open,
    show: (followUp: FollowUp) => setState({ held: followUp, open: true }),
    close: () => setState((now) => ({ ...now, open: false })),
  };
}
