import { addDaysKey, addMonthsKey, monthStartKey, todayKey } from "@/lib/dates/calendar";
import type { DayRange } from "@/lib/dates/range";

/** The month a day is in, from its first day to its last, in the clinic's timezone (D330). */
export function monthOf(day: string): DayRange {
  const from = monthStartKey(day);
  return { from, to: addDaysKey(addMonthsKey(from, 1), -1) };
}

/** This month's first day: where Expenses opens (D330). */
export const thisMonth = (today: string = todayKey()) => monthStartKey(today);

/** Whether a month — by its first day — is this one or later, so there is none after it to show: no expense is dated later (D328). */
export const isLatestMonth = (month: string, today: string = todayKey()) => month >= monthStartKey(today);

/**
 * A month's expenses, grouped by their day, newest first, each day's in the
 * order they came (D332).
 */
export function byDay<T extends { day: string }>(expenses: readonly T[]): { day: string; expenses: T[] }[] {
  const days: { day: string; expenses: T[] }[] = [];
  for (const expense of expenses) {
    const last = days.at(-1);
    if (last?.day === expense.day) last.expenses.push(expense);
    else days.push({ day: expense.day, expenses: [expense] });
  }
  return days;
}
