/**
 * A list's search, read the ways a person types it (ported from Brio): the
 * words — without the characters a LIKE pattern reads as wildcards, dropped
 * rather than escaped, since nobody searches for them — the digits a phone
 * holds, and a record's number. What is looked for goes to the database as
 * values, never as a filter's text.
 */
const UNSAFE = /[%_\\"(),*:]/g;

/** "Anu  Sharma" → "Anu Sharma", wildcards dropped; null when nothing is left to look for. */
export function searchWords(search: string): string | null {
  const term = search.replace(UNSAFE, " ").replace(/\s+/g, " ").trim();
  return term === "" ? null : term;
}

/**
 * The digits in a search, for matching a phone number however it was typed —
 * "98765 43210", "+91-98765-43210", "098765 43210" alike. Phones are stored
 * as `+91` and ten digits, so a longer number led by the country code or a
 * trunk 0 is matched on the ten that follow it. Fewer than three digits say
 * too little to match a phone on.
 */
export function phoneDigits(search: string): string | null {
  const digits = search.replace(/\D/g, "");
  const national =
    (digits.length > 10 && digits.startsWith("91")) || (digits.length === 11 && digits.startsWith("0"))
      ? digits.slice(digits.length - 10)
      : digits;
  return national.length >= 3 ? national : null;
}

/** A record's number as typed — "P-1012", "p 1012", "1012" — or null when the search is not one. */
export function recordNumber(search: string): number | null {
  const match = /^\s*[a-z]{0,3}\s*-?\s*(\d{1,9})\s*$/i.exec(search);
  return match ? Number(match[1]) : null;
}

/** Everything a search may be read as: words, a phone's digits, a record's number. */
export function searchTerms(search: string | null | undefined): {
  words: string | null;
  digits: string | null;
  number: number | null;
} {
  const words = search ? searchWords(search) : null;
  if (words === null) return { words: null, digits: null, number: null };
  return { words, digits: phoneDigits(words), number: recordNumber(words) };
}
