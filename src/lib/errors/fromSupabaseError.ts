import type { PostgrestError } from "@supabase/supabase-js";

import { isErrorMessageCode, type ErrorMessageCode } from "@/constants/messages";

import { AppError, type ErrorKind } from "./AppError";

/**
 * A Postgres/PostgREST failure as one of the app's errors. The driver's own
 * text names tables, columns and constraints, so it never reaches a user: each
 * code the app understands maps to a catalogue code, and anything else is
 * internals (AGENTS.md §13).
 */
const POSTGRES_ERRORS: Record<string, { kind: ErrorKind; code: ErrorMessageCode }> = {
  // A row-level security refusal, or a missing grant.
  "42501": { kind: "AUTHORIZATION", code: "AUTH_PERMISSION_DENIED" },
  // Two writes to the same rows at once; the loser can simply try again.
  "40P01": { kind: "CONFLICT", code: "CONFLICT" },
  "40001": { kind: "CONFLICT", code: "CONFLICT" },
  // A NOT NULL column left empty, or a value of the wrong shape.
  "23502": { kind: "VALIDATION", code: "VALIDATION_ERROR" },
  "22P02": { kind: "VALIDATION", code: "VALIDATION_ERROR" },
  "22003": { kind: "VALIDATION", code: "VALIDATION_ERROR" },
  // A function given an argument it does not take (invalid_parameter_value).
  "22023": { kind: "VALIDATION", code: "VALIDATION_ERROR" },
  // A duplicate key: the constraint name is in the message, so it is mapped.
  "23505": { kind: "CONFLICT", code: "CONFLICT" },
  // An exclusion constraint: a range that overlaps one already there.
  "23P01": { kind: "CONFLICT", code: "CONFLICT" },
  // Something still referenced, or a reference to something gone.
  "23503": { kind: "CONFLICT", code: "CONFLICT" },
  // A CHECK the database enforces.
  "23514": { kind: "BUSINESS_RULE", code: "VALIDATION_ERROR" },
  // .single() found no row, or several.
  PGRST116: { kind: "NOT_FOUND", code: "RECORD_NOT_FOUND" },
  // The session's token expired between refreshes.
  PGRST301: { kind: "AUTHENTICATION", code: "AUTH_SESSION_INVALID" },
};

/**
 * What a refusal the app raised itself says in its DETAIL — the appointment
 * it clashed with, say — as an object the client can use. Only ever read for a P0001
 * with a catalogue hint, which is the app's own words, never the driver's.
 */
function raisedDetails(err: PostgrestError): Record<string, unknown> | undefined {
  if (!err.details) return undefined;
  try {
    const parsed: unknown = JSON.parse(err.details);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** supabase-js turns a request that never reached the server into a codeless error. */
function isNetworkFailure(err: PostgrestError): boolean {
  return (
    !err.code && /failed to fetch|network request failed|networkerror|load failed|fetch failed/i.test(err.message ?? "")
  );
}

/**
 * The refusals the database raises for a business rule: 422. Each phase adds
 * the ones its functions raise.
 */
const BUSINESS_RULES: ReadonlySet<ErrorMessageCode> = new Set<ErrorMessageCode>([
  // A write while the clinic's plan has run out (plan §7.3).
  "CLINIC_PLAN_EXPIRED",
  // Archiving the last of what a clinic must keep (0010, D83).
  "CONSULTATION_SERVICE_REQUIRED",
  "APPOINTMENT_TYPE_REQUIRED",
  "EXPENSE_CATEGORY_REQUIRED",
  // Removing a holiday or leave that is over (0011, D84).
  "CLOSURE_OVER",
  // The team (0012): who may be invited, what may be granted, a link run out.
  "MEMBER_DEACTIVATED_HERE",
  "INVITE_EMAIL_NOT_ALLOWED",
  "TEAM_MANAGE_OWNER_ONLY",
  "TEAM_PERMISSION_NOT_HELD",
  "INVITE_SENT_RECENTLY",
  "INVITE_EXPIRED",
  // Changing the team (0013, D93): whom, and whose.
  "TEAM_OWNER_UNCHANGEABLE",
  "TEAM_NOT_YOURSELF",
  "TEAM_MEMBER_NOT_YOURS",
  "MEMBER_STILL_INVITED",
  // The owner's own doctor details, while they see no patients (0014).
  "OWNER_NOT_DOCTOR",
  // Patients (0015): an archived one is read-only (D103); a doctor no longer on the team.
  "PATIENT_ARCHIVED",
  "DOCTOR_INACTIVE",
  // Appointments (0017): when and what may be booked, moved and arrived; archiving one with some to come (D140).
  "APPOINTMENT_ON_CLOSED_DAY",
  "APPOINTMENT_IN_PAST",
  "APPOINTMENT_STATUS_NOT_ALLOWED",
  "APPOINTMENT_NOT_MOVABLE",
  "APPOINTMENT_NOT_TODAY",
  "APPOINTMENT_NOT_REMINDABLE",
  "APPOINTMENT_TYPE_INACTIVE",
  "PATIENT_HAS_APPOINTMENTS",
  // The queue (0018): an appointment whose visit was kept ends with Done (D197).
  "APPOINTMENT_HAS_VISIT",
  // Prescriptions (0021): only once the doctor has a registration number (D213).
  "PRESCRIPTION_NEEDS_REGISTRATION",
]);

/**
 * The kind a catalogue code belongs to, by its naming convention. Also used
 * for a write that changed no row (requireRow).
 */
export function kindOf(code: ErrorMessageCode): ErrorKind {
  if (code === "AUTH_SESSION_REQUIRED" || code === "AUTH_SESSION_INVALID") return "AUTHENTICATION";
  if (code === "AUTH_PERMISSION_DENIED") return "AUTHORIZATION";
  if (code === "NOT_FOUND" || code === "RECORD_NOT_FOUND") return "NOT_FOUND";
  if (/^CONFLICT$|_ALREADY_EXISTS$|_CHANGED$|_TAKEN$/.test(code)) return "CONFLICT";
  if (BUSINESS_RULES.has(code)) return "BUSINESS_RULE";
  if (code === "EXTERNAL_SERVICE_ERROR") return "EXTERNAL_SERVICE";
  if (code === "INTERNAL_ERROR" || code === "CONFIG_INVALID") return "INTERNAL";
  return "VALIDATION";
}

export function fromPostgrestError(err: PostgrestError): AppError {
  // A refusal raised through RAISE ... USING HINT carries its catalogue code in
  // the hint; the app shows its own wording for it.
  if (err.code === "P0001" && isErrorMessageCode(err.hint)) {
    return new AppError({ kind: kindOf(err.hint), code: err.hint, details: raisedDetails(err), cause: err });
  }

  const mapped = POSTGRES_ERRORS[err.code];
  if (mapped) return new AppError({ ...mapped, cause: err });

  if (isNetworkFailure(err)) {
    return new AppError({ kind: "NETWORK", code: "EXTERNAL_SERVICE_ERROR", cause: err });
  }

  // Anything else is internals — a missing column, a bad query.
  return new AppError({ kind: "INTERNAL", code: "INTERNAL_ERROR", cause: err });
}
