import { UI_TEXT } from "@/constants/messages";
import { GENDER_LABELS, type Gender } from "@/constants/statuses";
import { todayKey } from "@/lib/dates/calendar";
import { formatAge } from "@/lib/format/age";
import { formatNearDate } from "@/lib/format/date";

/**
 * A patient's line under their name, wherever one is listed (plan §10.2):
 * "34 y · Female · P-1007" — enough to tell one of a family from another.
 */
export function describePatient(patient: { dateOfBirth: string; gender: Gender; number: number }): string {
  return [formatAge(patient.dateOfBirth), GENDER_LABELS[patient.gender], UI_TEXT.patients.number(patient.number)].join(
    " · ",
  );
}

/**
 * When a patient was last seen, on the patients list (D228, D229): "Last
 * visit: today", "Last visit: 28 Sep" — the year when it is not this one —
 * or nothing for a patient never seen.
 */
export function lastVisitLine(day: string | null, today: string = todayKey()): string | null {
  if (day === null) return null;
  return day === today ? UI_TEXT.patients.lastVisitToday : UI_TEXT.patients.lastVisit(formatNearDate(day, today));
}
