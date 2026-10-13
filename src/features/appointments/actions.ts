import { hasAccess, type Permission } from "@/constants/permissions";
import type { ClinicRole } from "@/constants/roles";
import { APPOINTMENT_STATUS_TRANSITIONS } from "@/constants/statuses";
import { todayKey } from "@/lib/dates/calendar";

import type { AppointmentDetail } from "./types";

/** What an appointment's detail offers (plan §11.2). */
export interface AppointmentActions {
  arrive: boolean;
  remind: boolean;
  confirm: boolean;
  reschedule: boolean;
  editNotes: boolean;
  noShow: boolean;
  cancel: boolean;
  /** The queue's moves (plan §11.4; D192 – D198). */
  sendIn: boolean;
  done: boolean;
  backToWaiting: boolean;
  stepOut: boolean;
  stepBack: boolean;
  /** Urgent, or not (D201). */
  markUrgent: boolean;
  unmarkUrgent: boolean;
  /** Reading its visit (D195): offered whatever else is not. */
  openVisit: boolean;
}

/** Nothing offered. */
export const NO_ACTIONS: AppointmentActions = {
  arrive: false,
  remind: false,
  confirm: false,
  reschedule: false,
  editNotes: false,
  noShow: false,
  cancel: false,
  sendIn: false,
  done: false,
  backToWaiting: false,
  stepOut: false,
  stepBack: false,
  markUrgent: false,
  unmarkUrgent: false,
  openVisit: false,
};

/** A booking still to come, today or later: what a reminder is sent for (D184). */
export const isRemindable = (
  appointment: Pick<AppointmentDetail, "source" | "status" | "day">,
  today: string = todayKey(),
) => isMovable(appointment) && appointment.day >= today;

/** A booking not yet arrived: what may move (plan §11.1). */
export const isMovable = (appointment: Pick<AppointmentDetail, "source" | "status">) =>
  appointment.source === "BOOKED" && (appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED");

/**
 * What an appointment's detail offers to whoever is looking (plan §11.2;
 * D161 – D164), as its status allows:
 *
 * - **Arrived** for one booked, or a no-show come late, on its own day
 *   (D143, D164) — the patient takes their token.
 * - **Remind on WhatsApp** a booking still to come, today or later (D184).
 * - **Confirm** a booking still scheduled, on its day or before it.
 * - **Reschedule** a booking not yet arrived; any other offers **Edit notes**,
 *   since notes change at any time (plan §11.1).
 * - **No-show** once its time has come (D163).
 * - **Cancel** while it is still to happen — `appointments.cancel`.
 * - **Send in** a waiting patient; **Stepped out** and **Back** for one away
 *   for a moment (D198); **Done** and **Back to waiting** for one in (D197).
 * - **Urgent** for a waiting patient; **Not urgent** while they wait or are
 *   in (D201).
 * - **Open visit** once there is one, to whoever reads visits (D195).
 *
 * The rest need `appointments.edit`. A no-show or a cancellation is not
 * offered once a visit holds something (D197). An archived patient's
 * appointments offer nothing but their visit until they are restored (D103).
 * Read-only is the screen's to say.
 */
export function actionsFor(
  appointment: Pick<
    AppointmentDetail,
    "source" | "status" | "scheduledAt" | "day" | "patientArchived" | "steppedOutAt" | "urgentAt" | "visitId"
  >,
  member: { role: ClinicRole; permissions: readonly Permission[] },
  now: Date = new Date(),
): AppointmentActions {
  const openVisit = hasAccess(member, "visits.view") && appointment.visitId !== null;
  if (appointment.patientArchived) return { ...NO_ACTIONS, openVisit };
  const edits = hasAccess(member, "appointments.edit");
  const next = APPOINTMENT_STATUS_TRANSITIONS[appointment.status];
  const movable = isMovable(appointment);
  const today = todayKey(now);
  const waiting = appointment.status === "ARRIVED";
  const inRoom = appointment.status === "IN_PROGRESS";
  const unseen = appointment.visitId === null;
  return {
    arrive: edits && !inRoom && next.includes("ARRIVED") && appointment.day === today,
    remind: edits && isRemindable(appointment, today),
    confirm: edits && appointment.source === "BOOKED" && appointment.status === "SCHEDULED" && appointment.day >= today,
    reschedule: edits && movable,
    editNotes: edits && !movable,
    noShow: edits && unseen && next.includes("NO_SHOW") && now.getTime() >= Date.parse(appointment.scheduledAt),
    cancel: hasAccess(member, "appointments.cancel") && unseen && next.includes("CANCELLED"),
    sendIn: edits && waiting,
    done: edits && inRoom,
    backToWaiting: edits && inRoom,
    stepOut: edits && waiting && appointment.steppedOutAt === null,
    stepBack: edits && waiting && appointment.steppedOutAt !== null,
    markUrgent: edits && waiting && appointment.urgentAt === null,
    unmarkUrgent: edits && (waiting || inRoom) && appointment.urgentAt !== null,
    openVisit,
  };
}
