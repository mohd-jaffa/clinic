import { UI_TEXT } from "@/constants/messages";

const { home: words } = UI_TEXT;

/**
 * Home's greeting (plan §17) by the clinic's clock — morning until noon,
 * afternoon until five — and the person's first name, a doctor's as "Dr.
 * Rahul": "Good morning, Dr. Rahul". A name that already starts "Dr." is
 * greeted by the name after it.
 */
export function greetingOf(fullName: string, isDoctor: boolean, hour: number): string {
  const [first = "", second = ""] = fullName.trim().split(/\s+/);
  const titled = /^dr\.?$/i.test(first);
  const name = titled || isDoctor ? words.doctor(titled ? second : first) : first;
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return words.greeting[part](name);
}
