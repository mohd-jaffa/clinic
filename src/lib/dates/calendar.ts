/**
 * Days, as the clinic counts them (AGENTS.md §15). A clinic's day is the day
 * in India, not the day where the server or the browser happens to be, so
 * every "is this today?" question is answered here, against Asia/Kolkata.
 * `clinics.timezone` exists for later; V1 is India only (plan D9).
 */
export const CLINIC_TIME_ZONE = "Asia/Kolkata";

const DAY_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day an instant falls on in the clinic's timezone: "2026-09-22". */
export function dayKey(instant: string | Date): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return "";
  return DAY_PARTS.format(date);
}

export function todayKey(now: Date = new Date()): string {
  return dayKey(now);
}

/**
 * India keeps one offset all year, with no summer time, so a day in the
 * clinic's calendar always begins at this offset's midnight.
 */
const CLINIC_UTC_OFFSET = "+05:30";

/** A day some days on from a given one (back, for a negative count), as a key. */
export function addDaysKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The day after a given one, as a key. */
export function nextDayKey(key: string): string {
  return addDaysKey(key, 1);
}

/** The instant a day begins in the clinic's timezone, for a query's bounds. */
export function dayStart(key: string): string {
  return dayHour(key, 0);
}

/** The instant an hour of a day begins in the clinic's timezone: 8 AM on "2026-09-22". */
export function dayHour(key: string, hour: number): string {
  return new Date(`${key}T${String(hour).padStart(2, "0")}:00:00${CLINIC_UTC_OFFSET}`).toISOString();
}

/** The instant a time of a day falls at in the clinic's timezone: 10:30 AM on "2026-09-22", from "10:30". */
export function dayTime(key: string, time: string): string {
  return new Date(`${key}T${time}:00${CLINIC_UTC_OFFSET}`).toISOString();
}

/** The Monday of the week a day falls in. */
export function weekStartKey(key: string): string {
  const weekday = new Date(`${key}T00:00:00Z`).getUTCDay();
  return addDaysKey(key, -((weekday + 6) % 7));
}

/** The first of the month a day falls in. */
export function monthStartKey(key: string): string {
  return `${key.slice(0, 8)}01`;
}

/**
 * The same date some months on (back, for a negative count), kept inside a
 * shorter month: 31 Jan and one month is 28 Feb.
 */
export function addMonthsKey(key: string, months: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return first.toISOString().slice(0, 10);
}

/**
 * The month a day falls in as weeks from Monday, as a calendar draws it: null
 * before its first day and after its last.
 */
export function monthWeeks(key: string): (string | null)[][] {
  const first = monthStartKey(key);
  const cells: (string | null)[] = Array.from(
    { length: (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7 },
    () => null,
  );
  for (let day = first; day.slice(0, 7) === first.slice(0, 7); day = nextDayKey(day)) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/**
 * A calendar date carried as midnight UTC — how a spreadsheet's date cell is
 * read (plan §10.5) — as its day key. It names a day, not an instant, so it
 * is not moved into the clinic's timezone.
 */
export function utcDayKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Whether a text is a day of the calendar as a key: "2026-02-28", never "2026-02-30". */
export function isDayKey(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

/** How many days a run covers, both ends counted: 20 to 22 Oct is 3. */
export function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Every day from one to another, both included, as keys. */
export function daysFrom(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = nextDayKey(day)) days.push(day);
  return days;
}

const HOUR = new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIME_ZONE, hour: "numeric", hourCycle: "h23" });

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLINIC_TIME_ZONE,
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/** How far into its day, on the clinic's clock, an instant falls, in minutes: 10:30 AM is 630. */
export function minutesOfDay(instant: string | Date = new Date()): number {
  const parts = Object.fromEntries(
    CLOCK.formatToParts(instant instanceof Date ? instant : new Date(instant)).map((part) => [part.type, part.value]),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/** The hour on the clinic's clock, 0–23 — what Home's greeting goes by (plan §17). */
export function clinicHour(now: Date = new Date()): number {
  return Number(HOUR.format(now));
}

/**
 * The Indian financial year a day falls in, April to March, as bill numbers
 * carry it (plan D27): "2026-27" for any day from 1 April 2026 to 31 March 2027.
 */
export function financialYear(key: string): string {
  const year = Number(key.slice(0, 4));
  const start = Number(key.slice(5, 7)) >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
