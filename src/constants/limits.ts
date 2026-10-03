/**
 * The bounds a form or a route accepts (plan §26, AGENTS.md §27). These
 * protect columns and pages; a rule the platform admin may want to change is a
 * platform setting instead (plan §6), never a constant here.
 */

/**
 * The largest single amount: ₹10,00,000. Money is stored in integer paise, and
 * this keeps every field, and every bill's total, well inside its column.
 */
export const MAX_AMOUNT_PAISE = 100_000_000;

/** One bill line's quantity: 1 – 999 (plan §28.6). */
export const MAX_QUANTITY = 999;

/**
 * How many rows a list asks for at a time (plan §10.2): enough to fill a phone
 * twice over; **Show more** brings the next as many.
 */
export const PAGE_SIZE = 20;

/** How far into a list a page may start — far past any list a clinic keeps. */
export const MAX_PAGE_START = 100_000;

/** What a list's search box may send. */
export const MAX_SEARCH_LENGTH = 100;

/**
 * How long each kind of text may be (AGENTS.md §24). A schema bounds its field
 * by one of these, and the column's CHECK by the same number — tests/db keeps
 * the two equal — so a form can never accept what the database refuses.
 */
export const TEXT_LIMITS = {
  /** A person's name: a member's, a contact's. */
  personName: 100,
  clinicName: 100,
  city: 60,
  /** An address, on several lines. */
  address: 500,
  /** "Front desk", "Nurse" (plan §8.4). */
  jobTitle: 60,
  /** A doctor's specialization or qualifications: "Orthodontist", "BDS, MDS". */
  doctorDetail: 100,
  registrationNumber: 50,
  /** A price-list entry's name (plan §9). */
  serviceName: 100,
  /** An appointment type's or an expense category's name: a chip, not a sentence. */
  catalogueName: 60,
  /** What a closure is for: "Diwali", "Dental conference" — a row's title. */
  closureReason: 100,
  /** A payment's reference: a UPI transaction id, a cheque number. */
  reference: 100,
  /** Why something was done by hand: a plan date set, a void. */
  reason: 200,
  email: 254,
  /** A UPI id: "clinic@okicici". */
  upiId: 100,
  /** A phone number as typed, mobile or landline. */
  phoneNumber: 20,
  /** A record's own notes, on several lines: a patient's "prefers mornings". */
  notes: 1000,
  /** What an alert names: "Penicillin", "Metformin 500 mg" (plan §10.4). */
  alertLabel: 100,
  /** A line beside it: "rash, 2019". */
  alertNote: 200,
} as const;

/** How many digits a phone number has, mobile or landline, the country code included. */
export const PHONE_NUMBER_DIGITS = { min: 6, max: 15 } as const;

/** Each appointment type's default length, in minutes (plan §28.2). */
export const APPOINTMENT_MINUTES = { min: 5, max: 480 } as const;

/**
 * The oldest a patient may be, in years (plan §10.1): a date of birth is at
 * most this long ago, and an age at most this many (D100).
 */
export const MAX_PATIENT_AGE = 120;

/** How many patients "Already here?" lists for one mobile (D106): a family, and then some. */
export const MAX_PATIENT_MATCHES = 10;

/** How long a holiday or a doctor's leave may last, both ends counted (D85). */
export const MAX_CLOSURE_DAYS = 366;

/**
 * How long before another confirmation or password-reset email may go to the
 * same account (plan §5.1's Resend, §5.3): enough to stop a button pressed
 * over and over from filling someone's inbox, short enough that a person
 * waiting never notices.
 */
export const EMAIL_LINK_COOLDOWN_SECONDS = 60;

/** How much of a failure the error log keeps (0006_logs's CHECKs): enough to act on, never a novel. */
export const ERROR_LOG_LIMITS = { message: 500, path: 300, detail: 2000, stack: 8000 } as const;

/**
 * How long a link in an email works — confirming an email, resetting a
 * password: Supabase Auth's `otp_expiry` (supabase/config.toml, and the hosted
 * project's Auth settings), which allows at most a day. tests/db keeps the two
 * equal, so an email never promises longer than its link lasts.
 */
export const EMAIL_LINK_VALID_HOURS = 24;

/**
 * A password's length (plan §5.1): at least Supabase Auth's
 * `minimum_password_length` (supabase/config.toml, kept equal by tests/db), at
 * most the 72 characters its hashing reads.
 */
export const PASSWORD_LENGTH = { min: 8, max: 72 } as const;
