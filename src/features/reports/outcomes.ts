import type { AppointmentStatus } from "@/constants/statuses";

import type { StatusCounts } from "./types";

/** How a month's appointments ended, for the donut (D355): four parts, in the donut's order. */
export const OUTCOMES = ["COMPLETED", "STILL_TO_COME", "NO_SHOW", "CANCELLED"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Which statuses each part gathers: still to come is every one not yet ended. */
const GATHERS: Record<Outcome, readonly AppointmentStatus[]> = {
  COMPLETED: ["COMPLETED"],
  STILL_TO_COME: ["SCHEDULED", "CONFIRMED", "ARRIVED", "IN_PROGRESS"],
  NO_SHOW: ["NO_SHOW"],
  CANCELLED: ["CANCELLED"],
};

/** Each part's count, from the month's statuses, in the donut's order. */
export function outcomesOf(statuses: StatusCounts): { outcome: Outcome; count: number }[] {
  return OUTCOMES.map((outcome) => ({
    outcome,
    count: GATHERS[outcome].reduce((sum, status) => sum + (statuses[status] ?? 0), 0),
  }));
}
