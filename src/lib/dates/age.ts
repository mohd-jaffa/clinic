import { addMonthsKey } from "./calendar";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/**
 * How old someone is on a day (plan §10.1): whole years, the months since
 * their last birthday, and — for a newborn's sake — the days they have lived.
 * Null for a date that is not a day, or one still to come.
 */
export interface Age {
  years: number;
  months: number;
  days: number;
}

export function ageOn(birth: string, today: string): Age | null {
  if (!DATE_KEY.test(birth) || !DATE_KEY.test(today) || birth > today) return null;
  const [birthYear, birthMonth, birthDay] = birth.split("-").map(Number);
  const [year, month, day] = today.split("-").map(Number);
  const months = (year - birthYear) * 12 + (month - birthMonth) - (day < birthDay ? 1 : 0);
  return {
    years: Math.floor(months / 12),
    months: months % 12,
    days: Math.round((Date.parse(today) - Date.parse(birth)) / DAY_MS),
  };
}

/**
 * A date of birth for someone who gave only their age (plan §10.1): that many
 * years before today, stored with `dob_is_estimated` so it is never shown as
 * a real birthday.
 */
export function estimatedBirthDate(years: number, today: string): string {
  return addMonthsKey(today, -12 * years);
}
