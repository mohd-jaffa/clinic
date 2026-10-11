import { UI_TEXT } from "@/constants/messages";
import { CLINIC_TIME_ZONE, dayKey, todayKey } from "@/lib/dates/calendar";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDate(isoDate: string | null | undefined): string {
  const match = isoDate ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate) : null;
  if (!match) return "—";
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** An instant's parts on the clinic's clock, or null for no instant or an unreadable one. */
function clock(iso: string | null | undefined): Record<string, string> | null {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(PARTS.formatToParts(date).map((part) => [part.type, part.value]));
}

export function formatDateTime(iso: string | null | undefined): string {
  const part = clock(iso);
  if (!part) return "—";
  return `${part.day} ${MONTHS[Number(part.month) - 1]} ${part.year}, ${part.hour}:${part.minute} ${part.dayPeriod.toUpperCase()}`;
}

/** The time of day on the clinic's clock: "11:50 PM". */
export function formatTime(iso: string | null | undefined): string {
  const part = clock(iso);
  if (!part) return "—";
  return `${part.hour}:${part.minute} ${part.dayPeriod.toUpperCase()}`;
}

/** The month a date falls in, for grouping a list by it: "Sep 2026". */
export function formatMonth(isoDate: string | null | undefined): string {
  const match = isoDate ? /^(\d{4})-(\d{2})/.exec(isoDate) : null;
  if (!match) return "—";
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A month's short name, for a calendar's month grid: "Sep". */
export function formatMonthName(isoDate: string | null | undefined): string {
  const match = isoDate ? /^\d{4}-(\d{2})/.exec(isoDate) : null;
  return match ? MONTHS[Number(match[1]) - 1] : "—";
}

/** A month in full, for a calendar's heading: "September 2026". */
export function formatMonthYear(isoDate: string | null | undefined): string {
  const match = isoDate ? /^(\d{4})-(\d{2})/.exec(isoDate) : null;
  if (!match) return "—";
  return `${LONG_MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** A time of day as a field holds it ("09:15", "18:30"), the way the app writes one: "9:15 AM", "6:30 PM". */
export function formatClock(time: string | null | undefined): string {
  const match = time ? /^(\d{2}):(\d{2})$/.exec(time) : null;
  if (!match) return "—";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

/** An hour of the clock as a field holds it ("00" – "23"), the way the app writes one: "12 AM", "10 AM", "6 PM". */
export function formatHour(hour: string): string {
  const value = Number(hour);
  return `${value % 12 || 12} ${value < 12 ? "AM" : "PM"}`;
}

/** A date without its year, for a row where the year is already obvious: "13 Oct". */
export function formatDayMonth(isoDate: string | null | undefined): string {
  const match = isoDate ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate) : null;
  if (!match) return "—";
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]}`;
}

/**
 * A run of days, as short as it reads clearly: "20 Oct", "20 – 22 Oct",
 * "30 Oct – 2 Nov", the year added when it is not this one — "5 – 7 Jan
 * 2027", "28 Dec 2026 – 3 Jan 2027".
 */
export function formatDayRange(from: string, to: string, today: string = todayKey()): string {
  const [first, last] = [formatDate(from), formatDate(to)];
  if (first === "—" || last === "—") return "—";
  const [fromDay, fromMonth, fromYear] = first.split(" ");
  const [, toMonth, toYear] = last.split(" ");
  const year = fromYear === today.slice(0, 4) ? "" : ` ${fromYear}`;
  if (fromYear !== toYear) return `${first} – ${last}`;
  if (from === to) return `${fromDay} ${fromMonth}${year}`;
  if (fromMonth === toMonth) return `${fromDay} – ${last.slice(0, -5)}${year}`;
  return `${fromDay} ${fromMonth} – ${last.slice(0, -5)}${year}`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A day in full, for a heading: "Saturday, 26 Sep 2026". */
export function formatLongDate(isoDate: string | null | undefined): string {
  const day = formatDate(isoDate);
  if (day === "—") return day;
  return `${WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()]}, ${day}`;
}

const DAY_MS = 86_400_000;

/**
 * How long ago an instant was, counted in the clinic's days (plan
 * §10.2): "today", "yesterday", "2 days ago", then weeks, months and years
 * — enough to say how recently someone ordered, not when to the minute.
 */
export function formatDaysAgo(iso: string, now: Date = new Date()): string {
  const text = UI_TEXT.ago;
  const days = Math.max(0, Math.round((Date.parse(todayKey(now)) - Date.parse(dayKey(iso))) / DAY_MS));
  if (days === 0) return text.today;
  if (days === 1) return text.yesterday;
  if (days < 7) return text.days(days);
  if (days < 30) return text.weeks(Math.floor(days / 7));
  if (days < 365) return text.months(Math.floor(days / 30));
  return text.years(Math.floor(days / 365));
}

/**
 * When something happened, for a timeline (plan §10.3): the time if it was
 * today, then "Yesterday", "2 days ago" and on.
 */
export function formatRecent(iso: string, now: Date = new Date()): string {
  if (dayKey(iso) === todayKey(now)) return formatTime(iso);
  const ago = formatDaysAgo(iso, now);
  return ago.charAt(0).toUpperCase() + ago.slice(1);
}
