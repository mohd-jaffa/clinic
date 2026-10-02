/**
 * Every word the app says, in one place (AGENTS.md §5, §27). No screen, route
 * or schema writes a message inline: a wording is changed here once, and the
 * server and the client cannot end up saying different things about the same
 * failure. The voice is warm and plain (PRODUCT.md): an error says what
 * happened and what to do next, never more.
 */

export const ERROR_MESSAGES = {
  VALIDATION_ERROR: "Please check the highlighted fields.",
  VALIDATION_INVALID_JSON: "The request body must be valid JSON.",
  IDEMPOTENCY_KEY_REQUIRED: "This request could not be checked for repeats. Please try again.",

  AUTH_SESSION_REQUIRED: "Please sign in to continue.",
  AUTH_SESSION_INVALID: "Your session has expired. Please sign in again.",
  AUTH_PERMISSION_DENIED: "You don't have permission to do this. Your clinic's owner can give it to you.",

  // A refusal while the clinic's plan has run out (plan §7.3).
  CLINIC_PLAN_EXPIRED: "Your clinic is view-only until its plan is renewed.",

  LOGO_TOO_LARGE: "That logo is larger than 500 KB.",

  CONFLICT: "Someone else changed this at the same moment. Refresh and try again.",
  NOT_FOUND: "We couldn't find that.",
  RECORD_NOT_FOUND: "That record could not be found. Refresh and try again.",
  EXTERNAL_SERVICE_ERROR: "A connected service didn't answer. Please try again.",
  CONFIG_INVALID: "The server's configuration is invalid.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again.",
} as const;

export type ErrorMessageCode = keyof typeof ERROR_MESSAGES;

export function isErrorMessageCode(code: string | null | undefined): code is ErrorMessageCode {
  return code != null && Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, code);
}

/** The wording for a code; an unknown code reads as a failure of our own, never as its raw text. */
export function getErrorMessage(code: ErrorMessageCode | string): string {
  return isErrorMessageCode(code) ? ERROR_MESSAGES[code] : ERROR_MESSAGES.INTERNAL_ERROR;
}

/**
 * What a field says when it is wrong, beside the field (AGENTS.md §24). Every
 * schema takes its words from here and never falls back to Zod's own English;
 * tests/unit/lib/validation/index.test.ts fails if one does.
 */
export const VALIDATION_MESSAGES = {
  required: (label: string) => `${label} needs a value.`,
  wholeNumber: (label: string) => `${label} must be a whole number.`,
  notNegative: (label: string) => `${label} cannot be negative.`,
  amount: (label: string) => `${label} must be a valid amount.`,
  email: (label: string) => `${label} must look like name@example.com.`,
  tooLarge: (label: string, max: string) => `${label} can be at most ${max}.`,
  phone: "Enter a valid 10-digit mobile number.",
  moreThanZero: (label: string) => `${label} must be more than 0.`,
  tooLong: (label: string, max: number) => `${label} can be at most ${max} characters.`,
  tooShort: (label: string, min: number) => `${label} must be at least ${min} characters.`,
  invalid: "That value is not valid.",
} as const;

export const UI_TEXT = {
  /** A working name (plan D35): the final one replaces it here and nowhere else. */
  appName: "ClinicDesk",
  appDescription: "The front desk and consulting room of your clinic, on any device.",

  /** An age, short enough for a row or a prescription (plan §10.1). */
  age: {
    years: (count: number) => `${count} y`,
    months: (count: number) => `${count} mo`,
    days: (count: number) => `${count} d`,
  },

  /** How long ago something happened, by the clinic's calendar: "2 days ago". */
  ago: {
    today: "today",
    yesterday: "yesterday",
    days: (count: number) => `${count} days ago`,
    weeks: (count: number) => (count === 1 ? "a week ago" : `${count} weeks ago`),
    months: (count: number) => (count === 1 ? "a month ago" : `${count} months ago`),
    years: (count: number) => (count === 1 ? "a year ago" : `${count} years ago`),
  },
} as const;
