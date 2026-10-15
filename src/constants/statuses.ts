/**
 * Every vocabulary the database also knows (plan §26), with the words a screen
 * shows for it. Each has a CHECK in its migration that tests/db keeps equal to
 * the list here (AGENTS.md §25). Later phases add theirs as their tables come.
 */

/**
 * How a status pill colours a status (plan §32.1): live in the action green,
 * needing attention in coral, anything else quiet. The word always carries
 * the meaning; the tone only repeats it.
 */
export type StatusTone = "neutral" | "live" | "attention";

/** A membership's state (plan §8): invited until accepted, inactive when deactivated. */
export const MEMBER_STATUSES = ["INVITED", "ACTIVE", "INACTIVE"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  INVITED: "Invited",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};
export const MEMBER_STATUS_TONES: Record<MemberStatus, StatusTone> = {
  INVITED: "neutral",
  ACTIVE: "live",
  INACTIVE: "neutral",
};

/** What kind of clinic it is (plan §5.1). */
export const CLINIC_TYPES = ["DENTAL", "GENERAL", "PHYSIOTHERAPY", "DERMATOLOGY", "OTHER"] as const;
export type ClinicType = (typeof CLINIC_TYPES)[number];
export const CLINIC_TYPE_LABELS: Record<ClinicType, string> = {
  DENTAL: "Dental",
  GENERAL: "General",
  PHYSIOTHERAPY: "Physiotherapy",
  DERMATOLOGY: "Dermatology",
  OTHER: "Other",
};

/** A patient's gender (plan §10.1, D33). */
export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

/** What a patient's alert warns of (plan §10.4): allergies first, wherever they show. */
export const ALERT_KINDS = ["ALLERGY", "CONDITION", "MEDICATION"] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];
export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  ALLERGY: "Allergy",
  CONDITION: "Condition",
  MEDICATION: "Medication",
};

/** Where an appointment came from (plan §11.1, §11.3): booked ahead, or added at the desk. */
export const APPOINTMENT_SOURCES = ["BOOKED", "WALK_IN"] as const;
export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];
export const APPOINTMENT_SOURCE_LABELS: Record<AppointmentSource, string> = {
  BOOKED: "Booked",
  WALK_IN: "Walk-in",
};

/** An appointment's status (plan §11.2). */
export const APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  ARRIVED: "Arrived",
  IN_PROGRESS: "With doctor",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};
export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, StatusTone> = {
  SCHEDULED: "neutral",
  CONFIRMED: "live",
  ARRIVED: "live",
  IN_PROGRESS: "live",
  COMPLETED: "neutral",
  CANCELLED: "neutral",
  NO_SHOW: "attention",
};

/**
 * Where an appointment's status may go next (plan §11.2), mirrored by
 * `appointment_status_next()` in 0017 and kept equal by tests/db. An arrived
 * patient who leaves before being seen is a no-show (D138). In progress and
 * done are reached only through the queue (plan §11.4).
 */
export const APPOINTMENT_STATUS_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "ARRIVED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["ARRIVED", "SCHEDULED", "CANCELLED", "NO_SHOW"],
  ARRIVED: ["IN_PROGRESS", "SCHEDULED", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "ARRIVED"],
  NO_SHOW: ["ARRIVED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * The statuses an appointment's detail sets (plan §11.2), through
 * `change_appointment_status` in 0017: confirmed, back to scheduled,
 * cancelled with a reason, or a no-show. Arriving and the queue's moves have
 * their own functions.
 */
export const APPOINTMENT_STATUS_CHANGES = ["SCHEDULED", "CONFIRMED", "CANCELLED", "NO_SHOW"] as const;
export type AppointmentStatusChange = (typeof APPOINTMENT_STATUS_CHANGES)[number];

/**
 * What becomes of those already in with a doctor when another is sent in
 * (D192): marked done first, or kept in — a second chair. `send_in` in 0018.
 */
export const SEND_IN_CHOICES = ["FINISH", "KEEP"] as const;
export type SendInChoice = (typeof SEND_IN_CHOICES)[number];

/** A visit's status (plan §12.1): open while the patient is in, done once closed. */
export const VISIT_STATUSES = ["OPEN", "COMPLETED"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];
export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = { OPEN: "Open", COMPLETED: "Done" };
export const VISIT_STATUS_TONES: Record<VisitStatus, StatusTone> = { OPEN: "live", COMPLETED: "neutral" };

/** Where a closed visit stands with billing (plan §15.6, D46). */
export const BILLING_STATUSES = ["TO_BILL", "BILLED", "NO_CHARGE"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];
export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  TO_BILL: "To bill",
  BILLED: "Billed",
  NO_CHARGE: "No charge",
};

/** Why a visit is free (plan §15.6): Other takes a note. */
export const NO_CHARGE_REASONS = ["REVIEW", "COURTESY", "OTHER"] as const;
export type NoChargeReason = (typeof NO_CHARGE_REASONS)[number];
export const NO_CHARGE_REASON_LABELS: Record<NoChargeReason, string> = {
  REVIEW: "Review",
  COURTESY: "Courtesy",
  OTHER: "Other",
};

/** When a medicine is taken (plan §13): around food, or at bedtime. 0021's CHECK. */
export const PRESCRIPTION_TIMINGS = ["BEFORE_FOOD", "AFTER_FOOD", "WITH_FOOD", "EMPTY_STOMACH", "BEDTIME"] as const;
export type PrescriptionTiming = (typeof PRESCRIPTION_TIMINGS)[number];
export const PRESCRIPTION_TIMING_LABELS: Record<PrescriptionTiming, string> = {
  BEFORE_FOOD: "Before food",
  AFTER_FOOD: "After food",
  WITH_FOOD: "With food",
  EMPTY_STOMACH: "Empty stomach",
  BEDTIME: "Bedtime",
};

/**
 * A treatment's status (plan §14.1): 0024's CHECK. A treatment is open —
 * on the profile, due again, keeping its patient from being archived (D255)
 * — until it is completed or cancelled.
 */
export const TREATMENT_STATUSES = ["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number];
export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
export const TREATMENT_STATUS_TONES: Record<TreatmentStatus, StatusTone> = {
  PLANNED: "neutral",
  IN_PROGRESS: "live",
  ON_HOLD: "neutral",
  COMPLETED: "neutral",
  CANCELLED: "neutral",
};

/** The statuses a treatment is open in: not yet completed or cancelled. */
export const OPEN_TREATMENT_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
] as const satisfies readonly TreatmentStatus[];

/** The statuses a treatment starts in (0024's check_treatment): planned, or begun at once. */
export const TREATMENT_START_STATUSES = ["PLANNED", "IN_PROGRESS"] as const satisfies readonly TreatmentStatus[];

/**
 * Where a treatment's status may go next (plan §14.1), mirrored by
 * `treatment_status_next()` in 0024 and kept equal by tests/db. The first
 * session on a planned or on-hold treatment puts it in progress (D248).
 */
export const TREATMENT_STATUS_TRANSITIONS: Record<TreatmentStatus, readonly TreatmentStatus[]> = {
  PLANNED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** The paper bills and prescriptions print on (D28). */
export const PAPER_SIZES = ["A4", "A5"] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];
export const PAPER_SIZE_LABELS: Record<PaperSize, string> = { A4: "A4", A5: "A5" };

/** When the consultation fee is collected (D44). */
export const FEE_TIMINGS = ["AT_ARRIVAL", "AFTER_CONSULTATION"] as const;
export type FeeTiming = (typeof FEE_TIMINGS)[number];
export const FEE_TIMING_LABELS: Record<FeeTiming, string> = {
  AT_ARRIVAL: "At arrival",
  AFTER_CONSULTATION: "After the consultation",
};

/** A clinic's plan (plan §7.1). */
export const SUBSCRIPTION_PLANS = ["TRIAL", "MONTHLY", "YEARLY"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];
export const SUBSCRIPTION_PLAN_LABELS: Record<SubscriptionPlan, string> = {
  TRIAL: "Free trial",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

/** Where a clinic's plan stands (plan §7.2), derived from its date and the settings, never stored. */
export const SUBSCRIPTION_STATES = ["ACTIVE", "EXPIRING", "GRACE", "READ_ONLY"] as const;
export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number];
export const SUBSCRIPTION_STATE_LABELS: Record<SubscriptionState, string> = {
  ACTIVE: "Active",
  EXPIRING: "Ending soon",
  GRACE: "Ended",
  READ_ONLY: "View only",
};
export const SUBSCRIPTION_STATE_TONES: Record<SubscriptionState, StatusTone> = {
  ACTIVE: "live",
  EXPIRING: "attention",
  GRACE: "attention",
  READ_ONLY: "attention",
};

/** How the admin extends a plan (plan §7.4): a month, a year, or a date set by hand. */
export const EXTENSION_KINDS = ["MONTHLY", "YEARLY", "CUSTOM"] as const;
export type ExtensionKind = (typeof EXTENSION_KINDS)[number];
export const EXTENSION_KIND_LABELS: Record<ExtensionKind, string> = {
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
  CUSTOM: "Set date",
};

/** How money changed hands (plan §7.4, §15.3). */
export const PAYMENT_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  OTHER: "Other",
};

/** A price-list entry's kind (plan §9). */
export const SERVICE_CATEGORIES = ["CONSULTATION", "PROCEDURE", "INVESTIGATION", "MEDICINE", "OTHER"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];
export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  CONSULTATION: "Consultation",
  PROCEDURE: "Procedure",
  INVESTIGATION: "Investigation",
  MEDICINE: "Medicine",
  OTHER: "Other",
};

/** What an audit row records was done (plan §19, AGENTS.md §14). */
export const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", "ARCHIVE", "RESTORE", "VOID"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Where a failure in the error log happened (plan §36). */
export const ERROR_SOURCES = ["API", "SCREEN", "SERVER", "CRON"] as const;
export type ErrorSource = (typeof ERROR_SOURCES)[number];
