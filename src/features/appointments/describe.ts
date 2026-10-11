import { UI_TEXT } from "@/constants/messages";
import { APPOINTMENT_STATUS_LABELS } from "@/constants/statuses";
import { formatTime } from "@/lib/format/date";

import type { CalendarAppointment } from "./types";

const { calendar, appointments } = UI_TEXT;

/** What kind of appointment it is: its type — or, for a walk-in, that, with its token. */
export function kindOf(appointment: Pick<CalendarAppointment, "source" | "typeName" | "token">): string {
  if (appointment.source === "BOOKED") return appointment.typeName;
  return appointment.token === null ? calendar.walkIn : `${calendar.walkIn} ${calendar.token(appointment.token)}`;
}

/** When it is, start to end, on the clinic's clock: "9:00 AM – 9:15 AM". */
export function timeOf(appointment: Pick<CalendarAppointment, "scheduledAt" | "minutes">): string {
  const end = new Date(new Date(appointment.scheduledAt).getTime() + appointment.minutes * 60_000);
  return appointments.timeRange(formatTime(appointment.scheduledAt), formatTime(end.toISOString()));
}

/** An appointment said whole, as a screen reader reads a block the grid draws in a line or two. */
export function sayAppointment(appointment: CalendarAppointment): string {
  return calendar.said(
    timeOf(appointment),
    appointment.patientName,
    kindOf(appointment),
    APPOINTMENT_STATUS_LABELS[appointment.status],
  );
}
