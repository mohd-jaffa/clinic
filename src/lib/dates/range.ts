import type { DateRangeKind } from "@/constants/statuses";

import { addDaysKey, dayStart, monthStartKey, nextDayKey, todayKey } from "./calendar";

/** Days from one to another, both counted, as keys. */
export interface DayRange {
  from: string;
  to: string;
}

/** A list's days as they were picked (D320): a chip, or From – To. */
export interface DateRange extends DayRange {
  kind: DateRangeKind;
}

/**
 * The days a chip stands for, in the clinic's calendar (D320): today; the
 * last 7 days, today among them; this month so far.
 */
export function presetRange(kind: Exclude<DateRangeKind, "CUSTOM">, today: string = todayKey()): DayRange {
  if (kind === "WEEK") return { from: addDaysKey(today, -6), to: today };
  if (kind === "MONTH") return { from: monthStartKey(today), to: today };
  return { from: today, to: today };
}

/** Where a list's days start (D335): today. */
export const todayRange = (): DateRange => ({ kind: "TODAY", ...presetRange("TODAY") });

/** The instants a run of days spans, for a query: from the first day's start until the next day after the last. */
export function rangeBounds({ from, to }: DayRange): DayRange {
  return { from: dayStart(from), to: dayStart(nextDayKey(to)) };
}
