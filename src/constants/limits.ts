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

/**
 * The hour a payment recorded for an earlier day is stamped at, in the
 * clinic's timezone (D334): noon, so it counts on that day; today's is
 * stamped when it is recorded.
 */
export const EARLIER_PAYMENT_HOUR = 12;

/** One bill line's quantity: 1 – 999 (plan §28.6). */
export const MAX_QUANTITY = 999;

/** How many lines one bill holds (plan §28.6): more than any visit bills. 0028's CHECK. */
export const BILL_MAX_ITEMS = 50;

/** A percentage discount (plan §15.2, D291): a whole number, 1 – 100; 100 makes a bill that comes to nothing. */
export const DISCOUNT_PERCENT = { min: 1, max: 100 } as const;

/**
 * How many rows a list asks for at a time (plan §10.2): enough to fill a phone
 * twice over; **Show more** brings the next as many.
 */
export const PAGE_SIZE = 20;

/** How far into a list a page may start — far past any list a clinic keeps. */
export const MAX_PAGE_START = 100_000;

/**
 * The most days a list's From – To may span (D320): a year and a day, so a
 * financial year fits — longer is a report's, never one query's.
 */
export const MAX_RANGE_DAYS = 366;

/** How many of a visit's medicines its row in the history names before "+2" (D226). */
export const HISTORY_MEDICINES_NAMED = 2;

/** How many of a template's medicines its row in the Templates sheet names before "+1" (D241). */
export const TEMPLATE_MEDICINES_NAMED = 2;

/** How many of a visit's treatments its row in the history names before "+1" (D262). */
export const HISTORY_TREATMENTS_NAMED = 2;

/**
 * How far the follow-ups' Upcoming tab looks ahead, and Completed back, in
 * days (plan §14.3, D270): how far a list looks, not a rule a clinic lives
 * by. 0026's `follow_up_rows` holds the same number. When an overdue
 * follow-up lapses is the DEV's setting (`follow_up_lapsed_days`, §6).
 */
export const FOLLOW_UP_WINDOW_DAYS = 30;

/**
 * The chips beside "Remind me on" when a follow-up's contact is noted (plan
 * §14.3, D274): back in the lists this many days from today. Any later day
 * is picked from the calendar.
 */
export const REMIND_ME_CHOICES = [
  { key: "TOMORROW", days: 1 },
  { key: "3_DAYS", days: 3 },
  { key: "1_WEEK", days: 7 },
  { key: "2_WEEKS", days: 14 },
] as const;

export type RemindMeChoice = (typeof REMIND_ME_CHOICES)[number]["key"];

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
  /** What brought them in, and what the doctor found (plan §12.2). */
  complaint: 1000,
  diagnosis: 1000,
  /** A visit's notes: the doctor's longer account. */
  clinicalNotes: 4000,
  /** A prescription's medicine (plan §13): "Amoxicillin + Clavulanic acid". */
  medicine: 120,
  /** "500 mg", "1 tab", "1-0-1", or "Once a week" typed (D214). */
  strength: 40,
  dose: 40,
  frequency: 40,
  /** A line under a medicine: "Dissolve in water". */
  instructions: 200,
  /** The prescription's advice: diet, rest, what to watch for. */
  advice: 2000,
  /** A prescription template's name (D242): "Viral fever" — a row's title. */
  templateName: 60,
  /** A treatment's name (plan §14.1): "Root canal" — as long as the price list's, which suggests it. */
  treatmentName: 100,
  /** What a treatment is: "Upper left molar, three sittings". */
  treatmentDescription: 1000,
  /** What a visit did for a treatment: "Canal cleaned and dressed". */
  sessionNote: 1000,
  /** A line on a follow-up call: "Will call back on Monday". */
  contactNote: 200,
  /** A line on a payment: "Paid by her son". */
  paymentNote: 200,
  /** What an expense was for, when its category does not say (D329). */
  expenseDescription: 120,
} as const;

/** How many medicines one prescription holds (plan §13): more than any visit writes. 0021's CHECK. */
export const PRESCRIPTION_MAX_ITEMS = 30;

/** How many digits a phone number has, mobile or landline, the country code included. */
export const PHONE_NUMBER_DIGITS = { min: 6, max: 15 } as const;

/** Each appointment type's default length, in minutes (plan §28.2). */
export const APPOINTMENT_MINUTES = { min: 5, max: 480 } as const;

/** A booking starts on these steps of the clock (plan §11.1): 9:00, 9:05, 9:10. Kept equal to 0017's CHECK. */
export const APPOINTMENT_STEP_MINUTES = 5;

/**
 * The oldest a patient may be, in years (plan §10.1): a date of birth is at
 * most this long ago, and an age at most this many (D100).
 */
export const MAX_PATIENT_AGE = 120;

/**
 * Where a booking's hour list opens for a day other than today (D146): the
 * morning, when most clinics begin. Today's opens at the hour it is now. It
 * only scrolls the list; every hour can be booked (D7).
 */
export const FIRST_HOUR_SHOWN = 9;

/**
 * The calendar (plan §11.5): the grid's hours — 8 AM to 8 PM, reaching
 * earlier or later for a booking outside them (D152) — its rows a quarter of
 * an hour each, tapped to book there (D156), and how far the phone's date
 * strip reaches either side of today (D157). Every hour can be booked (D7).
 */
export const CALENDAR_HOURS = { from: 8, to: 20 } as const;
export const CALENDAR_STEP_MINUTES = 15;
export const DATE_STRIP_DAYS = { back: 7, ahead: 28 } as const;

/** The most days the calendar asks for at once: a week (D158). */
export const MAX_CALENDAR_DAYS = 7;

/**
 * How often today's queue is read again while it is on screen (plan §11.4,
 * D34), and on focus; never while the tab is hidden. Realtime is later.
 */
export const QUEUE_REFRESH_MS = 15_000;

/**
 * How much Home lists (D349): five of each — To bill's oldest, the follow-ups
 * due today, tomorrow's appointments, who owes most, the last payments and
 * expenses — and the next three waiting for each doctor.
 */
export const HOME_LIST_LIMITS = { list: 5, queue: 3 } as const;

/** How many patients a picker's search lists (D144): the best matches; typing more narrows them. */
export const PICKER_RESULTS = 6;

/** How many patients "Already here?" lists for one mobile (D106): a family, and then some. */
export const MAX_PATIENT_MATCHES = 10;

/**
 * How many rows one request of a patient import sends, and how many mobiles
 * one duplicate lookup asks about (plan §10.5): one quick transaction each,
 * and 50 requests for the 10,000 rows an import starts out allowed. How many
 * rows an import may hold is the platform's setting (D128), not this.
 */
export const IMPORT_BATCH_SIZE = 200;

/** How long a holiday or a doctor's leave may last, both ends counted (D85). */
export const MAX_CLOSURE_DAYS = 366;

/**
 * How many of the appointments on a holiday's or leave's days its sheet lists
 * (D137); how many there are in all is said above them.
 */
export const CLOSURE_APPOINTMENTS_SHOWN = 20;

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
