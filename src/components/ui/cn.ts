/**
 * Joins class names, dropping anything falsy. Small on purpose: the UI kit
 * needs conditional classes, not a styling library.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
