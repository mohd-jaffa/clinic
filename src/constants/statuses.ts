/**
 * Every vocabulary the database also knows (plan §26), with the words a screen
 * shows for it. Each has a CHECK in its migration that tests/db keeps equal to
 * the list here (AGENTS.md §25). Later phases add theirs as their tables come.
 */

/** A membership's state (plan §8): invited until accepted, inactive when deactivated. */
export const MEMBER_STATUSES = ["INVITED", "ACTIVE", "INACTIVE"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  INVITED: "Invited",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
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
