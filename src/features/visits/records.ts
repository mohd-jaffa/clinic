import type { BillingStatus } from "@/constants/statuses";
import { movesAudited } from "@/features/appointments/moves";
import { auditedChanges, changedFields } from "@/lib/audit/changes";
import { logActionsSafe } from "@/lib/audit/auditLog";
import type { AuditEntry } from "@/lib/audit/types";
import { fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type { SaveVitalsPayload, StartVisitPayload, VisitChangePayload } from "@/lib/validation";

import type { VisitNotes, VisitStarted, VitalsRow, VitalsSaved } from "./types";
import { toVitals, toVitalsRow, VITAL_COLUMNS } from "./vitals";

/**
 * What a visit records (plan §12.1, §12.2; D202 – D208), each section saved
 * alone by one function in 0020 that refuses a save made from an older copy
 * of it (D206), and New visit and its Done (D204). Clinical values are
 * audited by their field names alone; the follow-up's day by its value
 * (plan §27.6). Each save waits on two round trips after the session: the
 * function, the audit rows (plan §37).
 */

/** Where vitals go: a visit, or a patient still waiting, whose visit they open (D203). */
export type VitalsTarget = { visitId: string } | { appointmentId: string };

/** What save_vitals hands back: the visit, whether it opened, the readings' row, and the readings before and after. */
interface VitalsAnswer {
  visit_id: string;
  opened: boolean;
  vitals_id: string;
  before: VitalsRow | null;
  after: VitalsRow;
}

const READING_COLUMNS = Object.values(VITAL_COLUMNS);

/**
 * The vitals, whole (D202): to a visit, or to a waiting patient's appointment,
 * opening their visit with the first reading (D203). Audited by which
 * readings changed — and the visit, when they opened it.
 */
export async function saveVitals(
  tenant: Tenant,
  target: VitalsTarget,
  { vitals, seen }: SaveVitalsPayload,
  requestId?: string,
): Promise<VitalsSaved> {
  const { data, error } = await tenant.supabase.rpc("save_vitals", {
    p_visit_id: "visitId" in target ? target.visitId : null,
    p_appointment_id: "appointmentId" in target ? target.appointmentId : null,
    p_vitals: toVitalsRow(vitals),
    p_seen: seen === null ? null : toVitalsRow(seen),
  });
  if (error) throw fromPostgrestError(error);
  const answer = data as VitalsAnswer;
  const entries: AuditEntry[] = [];
  if (answer.opened) {
    entries.push(...movesAudited([{ entity: "VISIT", id: answer.visit_id, from: null, to: "OPEN" }], requestId));
  }
  const fields = changedFields(answer.before, answer.after, READING_COLUMNS);
  if (fields.length > 0) {
    entries.push({
      action: answer.before === null ? "CREATE" : "UPDATE",
      entityType: "vitals",
      entityId: answer.vitals_id,
      changes: { fields },
      requestId,
    });
  }
  await logActionsSafe(tenant, entries);
  return { visitId: answer.visit_id, vitals: toVitals(answer.after) };
}

/** A section's fields as the database names them. */
const COLUMNS = {
  complaint: "complaint",
  diagnosis: "diagnosis",
  notes: "notes",
  followUpOn: "follow_up_on",
} as const;

/** Clinical text: audited by name alone (plan §27.6). */
const CLINICAL = ["complaint", "diagnosis", "notes"];

type SectionRow = Partial<Record<(typeof COLUMNS)[keyof typeof COLUMNS], string | null>>;

/** A section's fields under the database's names. */
const asColumns = (fields: Record<string, string | null>): SectionRow =>
  Object.fromEntries(Object.entries(fields).map(([field, value]) => [COLUMNS[field as keyof typeof COLUMNS], value]));

/** A section's fields under the screen's names. */
const asFields = (row: SectionRow): Partial<VisitNotes & { followUpOn: string | null }> =>
  Object.fromEntries(
    Object.entries(COLUMNS)
      .filter(([, column]) => column in row)
      .map(([field, column]) => [field, row[column] ?? null]),
  );

/**
 * One of a visit's own sections (D202): complaint, diagnosis and notes, or the
 * follow-up date. Audited when it changed: the follow-up's day from what to
 * what, clinical text by name alone.
 */
export async function updateVisit(
  tenant: Tenant,
  id: string,
  { changes, seen }: VisitChangePayload,
  requestId?: string,
): Promise<Partial<VisitNotes & { followUpOn: string | null }>> {
  const { data, error } = await tenant.supabase.rpc("update_visit", {
    p_visit_id: id,
    p_changes: asColumns(changes),
    p_seen: asColumns(seen),
  });
  if (error) throw fromPostgrestError(error);
  const { before, after } = data as { before: SectionRow; after: SectionRow };
  // In the visit's own order: the database hands its keys back sorted its own way.
  const columns = Object.values(COLUMNS).filter((column) => column in after);
  const audited = auditedChanges(before, after, columns, CLINICAL);
  if (Object.keys(audited).length > 0) {
    await logActionsSafe(tenant, [
      { action: "UPDATE", entityType: "visits", entityId: id, changes: audited, requestId },
    ]);
  }
  return asFields(after);
}

/**
 * New visit (D204): from a patient's profile, with the doctor chosen — or
 * the visit already open with them. Audited when this started it.
 */
export async function startVisit(
  tenant: Tenant,
  { patientId, doctorId }: StartVisitPayload,
  requestId?: string,
): Promise<VisitStarted> {
  const { data, error } = await tenant.supabase
    .rpc("start_visit", { p_patient_id: patientId, p_doctor_id: doctorId })
    .single<{ visit_id: string; created: boolean }>();
  if (error) throw fromPostgrestError(error);
  if (data.created) {
    await logActionsSafe(
      tenant,
      movesAudited([{ entity: "VISIT", id: data.visit_id, from: null, to: "OPEN" }], requestId),
    );
  }
  return { visitId: data.visit_id, created: data.created };
}

/**
 * Done for a visit from a profile (D204): it closes as To bill (D46) — or
 * Billed, its own bill issued while it was open (§15.6) — audited once.
 */
export async function finishVisit(tenant: Tenant, id: string, requestId?: string): Promise<{ visitId: string }> {
  const { data, error } = await tenant.supabase
    .rpc("finish_visit", { p_visit_id: id })
    .single<{ previously: string; billing: BillingStatus }>();
  if (error) throw fromPostgrestError(error);
  if (data.previously === "OPEN") {
    await logActionsSafe(
      tenant,
      movesAudited([{ entity: "VISIT", id, from: "OPEN", to: "COMPLETED", billing: data.billing }], requestId),
    );
  }
  return { visitId: id };
}
