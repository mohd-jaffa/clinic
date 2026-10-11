import { hasAccess, type Permission } from "@/constants/permissions";
import type { ClinicRole } from "@/constants/roles";
import { APPOINTMENT_STATUS_TRANSITIONS } from "@/constants/statuses";
import { todayKey } from "@/lib/dates/calendar";

import type { AppointmentDetail } from "./types";

/** What an appointment's detail offers (plan §11.2). */
export interface AppointmentActions {
  arrive: boolean;
  confirm: boolean;
  reschedule: boolean;
  editNotes: boolean;
  noShow: boolean;
  cancel: boolean;
}

const NONE: AppointmentActions = {
  arrive: false,
  confirm: false,
  reschedule: false,
  editNotes: false,
  noShow: false,
  cancel: false,
};

/** A booking not yet arrived: what may move (plan §11.1). */
export const isMovable = (appointment: Pick<AppointmentDetail, "source" | "status">) =>
  appointment.source === "BOOKED" && (appointment.status === "SCHEDULED" || appointment.status === "CONFIRMED");

/**
 * What an appointment's detail offers to whoever is looking (plan §11.2;
 * D161 – D164), as its status allows:
 *
 * - **Arrived** for one booked, or a no-show come late, on its own day
 *   (D143, D164) — the patient takes their token.
 * - **Confirm** a booking still scheduled, on its day or before it.
 * - **Reschedule** a booking not yet arrived; any other offers **Edit notes**,
 *   since notes change at any time (plan §11.1).
 * - **No-show** once its time has come (D163).
 * - **Cancel** while it is still to happen — `appointments.cancel`.
 *
 * The rest need `appointments.edit`. An archived patient's appointments offer
 * nothing until they are restored (D103). Going back from the doctor to
 * waiting is the queue's (R6.1). Read-only is the screen's to say.
 */
export function actionsFor(
  appointment: Pick<AppointmentDetail, "source" | "status" | "scheduledAt" | "day" | "patientArchived">,
  member: { role: ClinicRole; permissions: readonly Permission[] },
  now: Date = new Date(),
): AppointmentActions {
  if (appointment.patientArchived) return NONE;
  const edits = hasAccess(member, "appointments.edit");
  const next = APPOINTMENT_STATUS_TRANSITIONS[appointment.status];
  const movable = isMovable(appointment);
  const today = todayKey(now);
  return {
    arrive: edits && appointment.status !== "IN_PROGRESS" && next.includes("ARRIVED") && appointment.day === today,
    confirm: edits && appointment.source === "BOOKED" && appointment.status === "SCHEDULED" && appointment.day >= today,
    reschedule: edits && movable,
    editNotes: edits && !movable,
    noShow: edits && next.includes("NO_SHOW") && now.getTime() >= Date.parse(appointment.scheduledAt),
    cancel: hasAccess(member, "appointments.cancel") && next.includes("CANCELLED"),
  };
}
