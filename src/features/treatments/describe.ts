import { UI_TEXT, WHATSAPP_TEXT } from "@/constants/messages";
import {
  FOLLOW_UP_OUTCOME_LABELS,
  TREATMENT_STATUS_TRANSITIONS,
  type FollowUpTab,
  type TreatmentStatus,
} from "@/constants/statuses";
import { dayCount, dayKey, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth } from "@/lib/format/date";

import { isOpen } from "./api";
import type { FollowUp, FollowUpContact, Treatment } from "./types";

const { treatments: words, followUps, appointment } = UI_TEXT;

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

/** What a follow-up is for, and with whom (plan §14.3): "Root canal · Dr. Maya Rao", "Follow-up · Dr. Maya Rao". */
export function followUpAbout(followUp: Pick<FollowUp, "title" | "doctorName">): string {
  return followUps.about(followUp.title ?? followUps.visitFollowUp, followUp.doctorName ?? appointment.formerDoctor);
}

/** When it is due, from today — "Due tomorrow", "Overdue by 4 days" — or, on Completed, "Completed 12 Oct". */
export function followUpWhen(followUp: Pick<FollowUp, "dueOn">, tab: FollowUpTab, today: string = todayKey()): string {
  return tab === "COMPLETED" ? words.completedOn(formatDayMonth(followUp.dueOn)) : dueLabel(followUp.dueOn, today);
}

/** The last contact, as a row reads it: "No answer, 14 Oct". */
export function lastContactLine(contact: Pick<FollowUpContact, "outcome" | "at">): string {
  return followUps.lastContact(FOLLOW_UP_OUTCOME_LABELS[contact.outcome], formatDayMonth(dayKey(contact.at)));
}

/**
 * A follow-up's reminder as the patient reads it on WhatsApp (plan §22.1,
 * D273): "Dr. Maya Rao at Smile Care asked to see you again around 14 Oct.
 * Reply or call 0484 234 5678 to book." — the doctor left out once they are
 * gone from the team, the call once the clinic has no phone.
 */
export function followUpReminderText(
  followUp: Pick<FollowUp, "doctorName" | "dueOn">,
  clinic: { name: string; phone: string | null },
): string {
  return WHATSAPP_TEXT.followUpReminder(
    followUp.doctorName === null ? null : WHATSAPP_TEXT.doctor(followUp.doctorName),
    clinic.name,
    formatDayMonth(followUp.dueOn),
    clinic.phone,
  );
}
