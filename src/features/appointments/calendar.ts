import { CALENDAR_HOURS } from "@/constants/limits";
import type { ClinicRole } from "@/constants/roles";
import type { AppointmentStatus } from "@/constants/statuses";
import type { Closure } from "@/features/clinic/types";
import { addDaysKey, minutesOfDay, weekStartKey } from "@/lib/dates/calendar";

import type { CalendarAppointment } from "./types";

/**
 * Whose appointments the calendar opens on (D155): a doctor's own; every
 * doctor's ("") for anyone else — the owner and the front desk. The page's
 * first read and the screen ask the same.
 */
export function firstDoctorFilter(member: { role: ClinicRole; doctorId: string | null }): string {
  return member.role === "DOCTOR" && member.doctorId ? member.doctorId : "";
}

/** The week a day falls in, Monday to Sunday (D158). */
export function weekOf(day: string): { from: string; to: string } {
  const from = weekStartKey(day);
  return { from, to: addDaysKey(from, 6) };
}

/** What the calendar shows where it is: none cancelled, none a no-show (D153). */
export const isLive = (status: AppointmentStatus) => status !== "CANCELLED" && status !== "NO_SHOW";

/** An appointment's minutes on its day's clock: where it starts and ends. */
export function minutesOf(appointment: Pick<CalendarAppointment, "scheduledAt" | "minutes">) {
  const start = minutesOfDay(appointment.scheduledAt);
  return { start, end: start + appointment.minutes };
}

/**
 * The hours the grid shows (D152): 8 AM to 8 PM, reaching to the hour before
 * the earliest appointment and after the latest when they fall outside —
 * never past midnight. In minutes from midnight.
 */
export function gridHours(appointments: readonly Pick<CalendarAppointment, "scheduledAt" | "minutes">[]) {
  let from = CALENDAR_HOURS.from * 60;
  let to = CALENDAR_HOURS.to * 60;
  for (const appointment of appointments) {
    const { start, end } = minutesOf(appointment);
    from = Math.min(from, Math.floor(start / 60) * 60);
    to = Math.max(to, Math.ceil(end / 60) * 60);
  }
  return { from, to: Math.min(to, 24 * 60) };
}

/** The closures a day falls in: the whole clinic's, and each doctor's leave. */
export function closuresOn(closures: readonly Closure[], day: string) {
  const on = closures.filter((closure) => closure.startsOn <= day && day <= closure.endsOn);
  return {
    clinic: on.find((closure) => closure.doctorId === null),
    leave: (doctorId: string) => on.find((closure) => closure.doctorId === doctorId),
    all: on,
  };
}
