import type { TreatmentStatus } from "@/constants/statuses";
import { auditedChanges } from "@/lib/audit/changes";
import { logActionSafe, logActionsSafe } from "@/lib/audit/auditLog";
import type { AuditEntry } from "@/lib/audit/types";
import { fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type {
  ChangeTreatmentPayload,
  FollowUpContactPayload,
  NewTreatmentPayload,
  TreatmentSessionPayload,
  TreatmentStatusPayload,
} from "@/lib/validation";

import type { ContactNoted, SessionSaved, TreatmentDetails } from "./types";

/**
 * Writing treatments (plan §14.1; D248 – D257), each through one function of
 * 0024 or 0025 that checks `visits.edit`, the doctor scope, an archived
 * patient and that the clinic can write, and refuses a change made from an
 * older copy (D251). Audited: statuses, the estimate, the days and the
 * doctor by value; the name, the description, a session's note and a
 * cancellation's reason — clinical — by name alone (plan §27.6). Each save
 * waits on two round trips after the session: the function, the audit rows
 * (plan §37).
 */

const TABLE = "treatments";
const SESSIONS = "treatment_sessions";

/** A treatment's columns a change may name, under the screen's names. */
const COLUMNS = {
  name: "name",
  description: "description",
  estimatedCostPaise: "estimated_cost_paise",
  nextDueOn: "next_due_on",
  doctorId: "doctor_id",
} as const;

type Column = (typeof COLUMNS)[keyof typeof COLUMNS];
type DetailRow = Partial<Record<Column, string | number | null>>;

/** Clinical text, audited by name alone. */
const CLINICAL: readonly string[] = ["name", "description", "note", "cancel_reason"];

/** Fields under the database's names. */
const asColumns = (fields: Partial<TreatmentDetails>): DetailRow =>
  Object.fromEntries(
    Object.entries(fields).map(([field, value]) => [COLUMNS[field as keyof typeof COLUMNS], value]),
  ) as DetailRow;

/** Columns under the screen's names, those given only. */
const asFields = (row: DetailRow): Partial<TreatmentDetails> =>
  Object.fromEntries(
    Object.entries(COLUMNS)
      .filter(([, column]) => column in row)
      .map(([field, column]) => [field, row[column] ?? null]),
  );

/** A move of a treatment's status, for the trail. */
const moved = (id: string, from: TreatmentStatus, to: TreatmentStatus, requestId?: string): AuditEntry => ({
  action: "STATUS_CHANGE",
  entityType: TABLE,
  entityId: id,
  changes: { status: { from, to } },
  requestId,
});

/**
 * A new treatment (plan §14.1; D252, D258): in a visit, its doctor's — and
 * begun today, that visit its first session — or from the profile, for the
 * doctor chosen. Audited as made, and its session with it.
 */
export async function createTreatment(
  tenant: Tenant,
  treatment: NewTreatmentPayload,
  requestId?: string,
): Promise<{ id: string; name: string }> {
  const row = {
    name: treatment.name,
    description: treatment.description,
    status: treatment.start,
    estimated_cost_paise: treatment.estimatedCost,
    next_due_on: treatment.nextDueOn,
  };
  const { data, error } = await tenant.supabase.rpc("create_treatment", {
    p_treatment: { ...row, patient_id: treatment.patientId, doctor_id: treatment.doctorId, note: treatment.note },
    p_visit_id: treatment.visitId,
  });
  if (error) throw fromPostgrestError(error);
  const made = data as { treatment_id: string; session_id: string | null };
  const entries: AuditEntry[] = [
    {
      action: "CREATE",
      entityType: TABLE,
      entityId: made.treatment_id,
      changes: auditedChanges(
        null,
        row,
        ["name", "description", "status", "estimated_cost_paise", "next_due_on"],
        CLINICAL,
      ),
      requestId,
    },
  ];
  if (made.session_id !== null) {
    entries.push({
      action: "CREATE",
      entityType: SESSIONS,
      entityId: made.session_id,
      changes: auditedChanges(null, { note: treatment.note }, ["note"], CLINICAL),
      requestId,
    });
  }
  await logActionsSafe(tenant, entries);
  return { id: made.treatment_id, name: treatment.name };
}

/**
 * A change to a treatment (D251, D252): its details — the name, what it is,
 * the estimate, its doctor — or its next due day, from the copy the screen
 * read. Audited when anything changed.
 */
export async function updateTreatment(
  tenant: Tenant,
  id: string,
  change: ChangeTreatmentPayload,
  requestId?: string,
): Promise<Partial<TreatmentDetails>> {
  const changes: Partial<TreatmentDetails> =
    change.part === "DETAILS"
      ? {
          name: change.changes.name,
          description: change.changes.description,
          estimatedCostPaise: change.changes.estimatedCost,
          doctorId: change.changes.doctorId,
        }
      : change.changes;
  const { data, error } = await tenant.supabase.rpc("update_treatment", {
    p_treatment_id: id,
    p_changes: asColumns(changes),
    p_seen: asColumns(change.seen),
  });
  if (error) throw fromPostgrestError(error);
  const { before, after } = data as { before: DetailRow; after: DetailRow };
  // In the treatment's own order: the database hands its keys back sorted its own way.
  const columns = Object.values(COLUMNS).filter((column) => column in after);
  const audited = auditedChanges(before, after, columns, CLINICAL);
  if (Object.keys(audited).length > 0) {
    await logActionsSafe(tenant, [{ action: "UPDATE", entityType: TABLE, entityId: id, changes: audited, requestId }]);
  }
  return asFields(after);
}

/**
 * Where a treatment stands (plan §14.1; D250, D251): moved as its status
 * allows, from the status the screen read; a cancellation with its reason or
 * none. The same move twice — a double tap — changes nothing more, and is
 * audited once.
 */
export async function changeTreatmentStatus(
  tenant: Tenant,
  id: string,
  { status, seen, reason }: TreatmentStatusPayload,
  requestId?: string,
): Promise<{ status: TreatmentStatus }> {
  const { data, error } = await tenant.supabase.rpc("change_treatment_status", {
    p_treatment_id: id,
    p_status: status,
    p_seen: seen,
    p_reason: reason,
  });
  if (error) throw fromPostgrestError(error);
  const { before, after } = data as { before: TreatmentStatus; after: TreatmentStatus };
  if (before !== after) {
    const entry = moved(id, before, after, requestId);
    if (reason !== null) entry.changes = { ...entry.changes, fields: ["cancel_reason"] };
    await logActionsSafe(tenant, [entry]);
  }
  return { status: after };
}

/**
 * What a visit did for a treatment (D248, D249, D256, D257): its session —
 * recorded, or its note changed from the copy read — and, when it completes
 * it, the treatment completed with it. Audited: the session, and each move
 * of the treatment's status.
 */
export async function recordSession(
  tenant: Tenant,
  treatmentId: string,
  visitId: string,
  { note, complete, seen }: TreatmentSessionPayload,
  requestId?: string,
): Promise<SessionSaved> {
  const { data, error } = await tenant.supabase.rpc("record_treatment_session", {
    p_treatment_id: treatmentId,
    p_visit_id: visitId,
    p_note: note,
    p_seen: seen,
    p_complete: complete,
  });
  if (error) throw fromPostgrestError(error);
  const saved = data as {
    session_id: string;
    created: boolean;
    before: { note: string | null } | null;
    after: { note: string | null };
    status_before: TreatmentStatus;
    status_after: TreatmentStatus;
  };
  const entries: AuditEntry[] = [];
  const changes = auditedChanges(saved.before, saved.after, ["note"], CLINICAL);
  if (saved.created || Object.keys(changes).length > 0) {
    entries.push({
      action: saved.created ? "CREATE" : "UPDATE",
      entityType: SESSIONS,
      entityId: saved.session_id,
      changes,
      requestId,
    });
  }
  // A first session starts a planned or on-hold one (D248); completing it moves it again (D257).
  if (saved.status_before !== saved.status_after) {
    const started = saved.status_before !== "IN_PROGRESS" && saved.created;
    if (started) entries.push(moved(treatmentId, saved.status_before, "IN_PROGRESS", requestId));
    if (saved.status_after === "COMPLETED") {
      entries.push(moved(treatmentId, started ? "IN_PROGRESS" : saved.status_before, "COMPLETED", requestId));
    }
  }
  await logActionsSafe(tenant, entries);
  return { note: saved.after.note, status: saved.status_after };
}

/** A session recorded by mistake, removed while its visit is open (D254); audited as removed. */
export async function removeSession(
  tenant: Tenant,
  treatmentId: string,
  visitId: string,
  requestId?: string,
): Promise<{ treatmentId: string; visitId: string }> {
  const { data, error } = await tenant.supabase.rpc("remove_treatment_session", {
    p_treatment_id: treatmentId,
    p_visit_id: visitId,
  });
  if (error) throw fromPostgrestError(error);
  const { session_id: sessionId } = data as { session_id: string };
  await logActionsSafe(tenant, [{ action: "DELETE", entityType: SESSIONS, entityId: sessionId, requestId }]);
  return { treatmentId, visitId };
}

/**
 * A contact noted about a follow-up (plan §14.3; D267, D271, D273) — a call
 * made, or a reminder sent on WhatsApp — through 0026's
 * `record_follow_up_contact`, which asks for `appointments.edit` or
 * `visits.edit`, keeps to the doctor scope, refuses an archived patient and a
 * view-only clinic, and takes a day to be reminded on only after today.
 * Audited: how it went and that day by value, the note by name alone. Waits
 * on two round trips after the session: the function, the audit row.
 */
export async function recordFollowUpContact(
  tenant: Tenant,
  contact: FollowUpContactPayload,
  requestId?: string,
): Promise<ContactNoted> {
  const row = { outcome: contact.outcome, note: contact.note, snooze_until: contact.snoozeUntil };
  const { data, error } = await tenant.supabase.rpc("record_follow_up_contact", {
    p_contact: { ...row, [contact.kind === "TREATMENT" ? "treatment_id" : "visit_id"]: contact.id },
  });
  if (error) throw fromPostgrestError(error);
  const made = data as Pick<ContactNoted, "outcome"> & {
    contact_id: string;
    patient_id: string;
    snooze_until: string | null;
  };
  await logActionSafe(tenant, {
    action: "CREATE",
    entityType: "follow_up_contacts",
    entityId: made.contact_id,
    changes: auditedChanges(null, row, ["outcome", "note", "snooze_until"], ["note"]),
    requestId,
  });
  return { id: made.contact_id, patientId: made.patient_id, outcome: made.outcome, snoozeUntil: made.snooze_until };
}
