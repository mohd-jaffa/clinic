import { UI_TEXT } from "@/constants/messages";
import { ageOn } from "@/lib/dates/age";
import { todayKey } from "@/lib/dates/calendar";

/**
 * An age as a list row or a prescription shows it: "34 y" for an adult, "8 mo"
 * for an infant, "12 d" for a newborn, "—" when there is no date to go by.
 */
export function formatAge(birth: string | null | undefined, today: string = todayKey()): string {
  const age = birth ? ageOn(birth, today) : null;
  if (!age) return "—";
  if (age.years > 0) return UI_TEXT.age.years(age.years);
  if (age.months > 0) return UI_TEXT.age.months(age.months);
  return UI_TEXT.age.days(age.days);
}
