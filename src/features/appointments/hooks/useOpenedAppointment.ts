"use client";

import { useState } from "react";

import type { CalendarAppointment } from "../types";

/**
 * The appointment a screen has open (D160): which, and whether it is still
 * showing — kept once closed, so its sheet has something to show as it goes.
 */
export function useOpenedAppointment() {
  const [state, setState] = useState<{ appointment: CalendarAppointment | null; open: boolean }>({
    appointment: null,
    open: false,
  });
  return {
    appointment: state.appointment,
    open: state.open,
    show: (appointment: CalendarAppointment) => setState({ appointment, open: true }),
    close: () => setState((now) => ({ ...now, open: false })),
  };
}
