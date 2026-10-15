import { UI_TEXT } from "@/constants/messages";
import { TREATMENT_STATUS_TRANSITIONS, type TreatmentStatus } from "@/constants/statuses";
import { dayCount, todayKey } from "@/lib/dates/calendar";

import { isOpen } from "./api";
import type { Treatment } from "./types";

const { treatments: words } = UI_TEXT;

/** When a treatment is next due, from today (plan §14.3): "Due today", "Due in 3 days", "Overdue by 4 days". */
export function dueLabel(nextDueOn: string, today: string = todayKey()): string {
  const days = dayCount(today, nextDueOn) - 1;
  if (days === 0) return words.dueToday;
  return days > 0 ? words.dueIn(days) : words.overdueBy(-days);
}

/**
 * Open treatments first, oldest first, as they were begun; then the closed,
 * the latest closed first (D260).
 */
export function inShowingOrder(treatments: readonly Treatment[]): { open: Treatment[]; closed: Treatment[] } {
  const closedOn = (treatment: Treatment) => treatment.completedOn ?? treatment.cancelledOn ?? "";
  return {
    open: treatments.filter((treatment) => isOpen(treatment.status)),
    closed: treatments
      .filter((treatment) => !isOpen(treatment.status))
      .sort((a, b) => closedOn(b).localeCompare(closedOn(a))),
  };
}

/**
 * The moves a treatment's sheet offers (D250, D256): those its status allows,
 * the one that carries it forward first — Start, Resume or Complete — then
 * Put on hold and Cancel.
 */
export const STATUS_MOVES = ["START", "RESUME", "COMPLETE", "HOLD", "CANCEL"] as const;
export type StatusMove = (typeof STATUS_MOVES)[number];

/** Where each move takes a treatment. */
export const MOVE_STATUS: Record<StatusMove, TreatmentStatus> = {
  START: "IN_PROGRESS",
  RESUME: "IN_PROGRESS",
  HOLD: "ON_HOLD",
  COMPLETE: "COMPLETED",
  CANCEL: "CANCELLED",
};

/** The moves a treatment's status allows: Start from planned, Resume from on hold, and the rest as the table has them. */
export function movesFrom(status: TreatmentStatus): StatusMove[] {
  const next = TREATMENT_STATUS_TRANSITIONS[status];
  return STATUS_MOVES.filter((move) => {
    if (!next.includes(MOVE_STATUS[move])) return false;
    if (move === "START") return status === "PLANNED";
    if (move === "RESUME") return status === "ON_HOLD";
    return true;
  });
}
