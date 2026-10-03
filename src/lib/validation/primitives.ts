import * as z from "zod";

import { MAX_AMOUNT_PAISE, MAX_QUANTITY, PASSWORD_LENGTH, PHONE_NUMBER_DIGITS, TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import { isDayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { parseRupees } from "@/lib/money";
import { toE164India } from "@/lib/phone";
import { normaliseLine, normaliseLines } from "@/lib/text/normalise";

/**
 * The building blocks the entity schemas in ./schemas are made of. Every
 * message comes from VALIDATION_MESSAGES (src/constants/messages.ts) and names
 * its field, so a person sees one wording whichever side catches the mistake.
 *
 * Client validation is for the person filling the form. The server parses the
 * same schema again, and the database's CHECK constraints are what actually
 * protect the data (AGENTS.md §24).
 */

/**
 * The last word on wording: a check that names no message of its own gets the
 * catalogue's, never Zod's English ("Too big: expected string to have <=100
 * characters" reached Brio's screens). Every field should still say what
 * is wrong with it; this is the floor, not the fix. It is set here because
 * every schema is built from these primitives, so it is in force wherever one
 * is parsed.
 */
z.config({ customError: () => VALIDATION_MESSAGES.invalid });

// A shape check, not a delivery check: something@something.something.
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A field that may be left out or left blank, stored as NULL. Missing, blank
 * and null are the same thing to a form, so they are the same thing here —
 * which also lets what one of these schemas produced be parsed by it again,
 * as it is when the client posts it and the server checks it (AGENTS.md §24).
 * `tidy` is how the text is normalised first; a plain trim by default.
 */
function optionalString(
  label: string,
  max: number,
  check?: { test: (value: string) => boolean; message: string },
  tidy: (text: string) => string = (text) => text.trim(),
) {
  return z.optional(z.union([z.string(), z.null()])).transform((text, ctx) => {
    const value = tidy(text ?? "");
    if (value === "") return null;
    if (value.length > max) {
      ctx.addIssue({ code: "custom", message: VALIDATION_MESSAGES.tooLong(label, max) });
      return z.NEVER;
    }
    if (check && !check.test(value)) {
      ctx.addIssue({ code: "custom", message: check.message });
      return z.NEVER;
    }
    return value;
  });
}

/**
 * Text a form must have, normalised by `tidy` and then bounded, each problem in
 * the field's own words. A blank field is missing, not too short.
 */
function requiredString(label: string, min: number, max: number, tidy: (text: string) => string) {
  return z.string({ error: VALIDATION_MESSAGES.required(label) }).transform((text, ctx) => {
    const value = tidy(text);
    const problem =
      value === ""
        ? VALIDATION_MESSAGES.required(label)
        : value.length < min
          ? VALIDATION_MESSAGES.tooShort(label, min)
          : value.length > max
            ? VALIDATION_MESSAGES.tooLong(label, max)
            : null;
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem });
      return z.NEVER;
    }
    return value;
  });
}

/** One line a form must have — a name, a clinic's name, a city (AGENTS.md §24). */
export function requiredLine(label: string, { min = 1, max }: { min?: number; max: number }) {
  return requiredString(label, min, max, normaliseLine);
}

/** One line that may be left empty — a reference, an item note; blank is null. */
export function optionalLine(label: string, max: number) {
  return optionalString(label, max, undefined, normaliseLine);
}

/** Several lines a form must have — a clinic's address. */
export function requiredLines(label: string, { min = 1, max }: { min?: number; max: number }) {
  return requiredString(label, min, max, normaliseLines);
}

/** Several lines that may be left empty — an address, notes; blank is null. */
export function optionalLines(label: string, max: number) {
  return optionalString(label, max, undefined, normaliseLines);
}

/** An email address that may be left empty; blank is null. */
export function optionalEmail(label: string, max: number = TEXT_LIMITS.email) {
  return optionalString(label, max, {
    test: (value) => EMAIL.test(value),
    message: VALIDATION_MESSAGES.email(label),
  });
}

/**
 * A mobile number, stored in one shape whichever way it was typed (plan §5.2).
 * The country code is added here: a person types the ten digits they think of
 * as their number, and the account it has to match is keyed on +91 and those
 * digits — so anything that skips this cannot find the account at all.
 */
export function indianMobile(label = "Mobile number") {
  return z
    .string()
    .trim()
    .min(1, VALIDATION_MESSAGES.required(label))
    .transform((typed, ctx) => {
      const e164 = toE164India(typed);
      if (e164 === null) {
        ctx.addIssue({ code: "custom", message: VALIDATION_MESSAGES.phone });
        return z.NEVER;
      }
      return e164;
    });
}

/**
 * A phone number as a person writes it, mobile or landline — "0484 234 5678",
 * "+91 98765 43210" — that may be left empty: 6 to 15 digits with spaces,
 * hyphens and brackets, kept as typed, as the database's is_phone_number()
 * checks it. A clinic prints its own number as it wrote it (plan §9).
 */
export function optionalPhoneNumber(label: string) {
  return optionalString(
    label,
    TEXT_LIMITS.phoneNumber,
    { test: isPhoneNumber, message: VALIDATION_MESSAGES.phoneNumber(label) },
    normaliseLine,
  );
}

// The GST number's own shape: state code, PAN, entity, Z, check character — as the clinics CHECK has it.
export const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * A GSTIN that may be left empty (plan §9): read without its spaces and in
 * capitals, however it was typed, then held to its shape.
 */
export function optionalGstin(label = "GSTIN") {
  return optionalString(label, 15, { test: (value) => GSTIN.test(value), message: VALIDATION_MESSAGES.gstin }, (text) =>
    text.replace(/\s+/g, "").toUpperCase(),
  );
}

// Digits with spaces, hyphens and brackets, a + only first; is_phone_number() uses the same.
export const PHONE_NUMBER = /^\+?[0-9(][0-9 ()-]*[0-9]$/;

export function isPhoneNumber(value: string): boolean {
  if (!PHONE_NUMBER.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= PHONE_NUMBER_DIGITS.min && digits <= PHONE_NUMBER_DIGITS.max;
}

/**
 * A password (plan §5.1): never trimmed, never altered (AGENTS.md §24) — what
 * was typed is the password — and long enough.
 */
export function password(label = "Password") {
  return z
    .string({ error: VALIDATION_MESSAGES.required(label) })
    .min(1, VALIDATION_MESSAGES.required(label))
    .min(PASSWORD_LENGTH.min, VALIDATION_MESSAGES.tooShort(label, PASSWORD_LENGTH.min))
    .max(PASSWORD_LENGTH.max, VALIDATION_MESSAGES.tooLong(label, PASSWORD_LENGTH.max));
}

/** An email address a form must have — trimmed and lower-cased, so it matches
 * the citext column it is stored in whatever way it was typed. */
export function requiredEmail(label: string, max: number = TEXT_LIMITS.email) {
  return z
    .string()
    .trim()
    .min(1, VALIDATION_MESSAGES.required(label))
    .max(max, VALIDATION_MESSAGES.tooLong(label, max))
    .refine((value) => EMAIL.test(value), VALIDATION_MESSAGES.email(label))
    .transform((value) => value.toLowerCase());
}

/**
 * An amount typed in rupees ("499.50", "₹1,500"), stored as whole paise. The
 * digits are read as written rather than multiplied as a float, so nothing is
 * ever a paisa out (AGENTS.md §16), and it is bounded so it fits its column.
 * This is what every money field in a form uses.
 */
export function paiseText(label: string, max = MAX_AMOUNT_PAISE) {
  return z
    .string({ error: VALIDATION_MESSAGES.required(label) })
    .trim()
    .transform((text, ctx) => {
      const refuse = (message: string) => {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      };
      if (text === "") return refuse(VALIDATION_MESSAGES.required(label));
      // Straight from the digits: never through a float.
      const paise = parseRupees(text);
      if (paise === null) return refuse(VALIDATION_MESSAGES.amount(label));
      if (paise > max) return refuse(VALIDATION_MESSAGES.tooLarge(label, formatPaise(max)));
      return paise;
    });
}

/**
 * An amount that has already been parsed to whole paise — what a route
 * receives. Bounded like the field it came from.
 */
export function paiseAmount(label: string, { allowZero = false, max = MAX_AMOUNT_PAISE } = {}) {
  const amount = z
    .number({ error: VALIDATION_MESSAGES.amount(label) })
    .int(VALIDATION_MESSAGES.wholeNumber(label))
    .max(max, VALIDATION_MESSAGES.tooLarge(label, formatPaise(max)));
  return allowZero
    ? amount.min(0, VALIDATION_MESSAGES.notNegative(label))
    : amount.positive(VALIDATION_MESSAGES.moreThanZero(label));
}

/**
 * A whole number typed into a text field — an appointment type's minutes —
 * read from its digits and held to its bounds, so "15" arrives as 15 and
 * "15.5" or "ten" is refused in words.
 */
export function wholeNumberText(label: string, { min, max }: { min: number; max: number }) {
  return z
    .string({ error: VALIDATION_MESSAGES.required(label) })
    .trim()
    .transform((text, ctx) => {
      const refuse = (message: string) => {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      };
      if (text === "") return refuse(VALIDATION_MESSAGES.required(label));
      if (!/^\d{1,9}$/.test(text)) return refuse(VALIDATION_MESSAGES.wholeNumber(label));
      const value = Number(text);
      if (value < min || value > max) return refuse(VALIDATION_MESSAGES.between(label, min, max));
      return value;
    });
}

/**
 * A day a date field holds — "2026-10-20" — that must be given, and must be
 * a day of the calendar: "2026-02-30" is refused in words, not moved on.
 */
export function requiredDay(label: string) {
  return z
    .string({ error: VALIDATION_MESSAGES.required(label) })
    .trim()
    .transform((text, ctx) => {
      if (text !== "" && isDayKey(text)) return text;
      ctx.addIssue({
        code: "custom",
        message: text === "" ? VALIDATION_MESSAGES.required(label) : VALIDATION_MESSAGES.day(label),
      });
      return z.NEVER;
    });
}

/**
 * How many of a thing a bill line is for: a whole number from 1 to 999.
 * An emptied number field arrives as NaN, and says so in words.
 */
export function quantity(label = "Quantity") {
  return z
    .number({
      error: (issue) =>
        issue.input === undefined || Number.isNaN(issue.input)
          ? VALIDATION_MESSAGES.required(label)
          : VALIDATION_MESSAGES.wholeNumber(label),
    })
    .int(VALIDATION_MESSAGES.wholeNumber(label))
    .min(1, VALIDATION_MESSAGES.moreThanZero(label))
    .max(MAX_QUANTITY, VALIDATION_MESSAGES.tooLarge(label, MAX_QUANTITY.toLocaleString("en-IN")));
}

/** The first message from a failed parse — what a single field shows. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? VALIDATION_MESSAGES.invalid;
}
