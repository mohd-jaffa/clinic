import { hasAccess } from "@/constants/permissions";
import { authorizationError, fromPostgrestError, notFoundError } from "@/lib/errors";
import { tenantRecords } from "@/lib/supabase/records";
import type { Tenant } from "@/lib/supabase/tenant";
import type { AlertPayload, UpdateAlertPayload } from "@/lib/validation";

import { getPatient } from "./api";
import type { AlertRow, PatientAlert } from "./types";

/**
 * A patient's alerts (plan §10.4, D117 – D120): allergies, conditions and
 * current medications. Read with `visits.view`, written with `visits.edit`,
 * within the doctor scope (D3) — the policies hold it, and the patient is
 * found first so one out of reach is not found rather than empty. Added, its
 * name and note changed, or turned off; never deleted, and never changed
 * while the patient is archived (D103). The audit names what was written,
 * never the words (plan §27.6).
 */
const COLUMNS = "id, patient_id, kind, label, note, active";

const records = (tenant: Tenant) =>
  tenantRecords<AlertRow>(tenant, "patient_alerts", {
    columns: COLUMNS,
    taken: "ALERT_ALREADY_EXISTS",
    named: ["label", "note"],
  });

export const toAlert = (row: AlertRow): PatientAlert => ({
  id: row.id,
  kind: row.kind,
  label: row.label,
  note: row.note,
  active: row.active,
});

/** A patient's alerts, turned off ones too, oldest first. */
export async function listAlerts(tenant: Tenant, patientId: string): Promise<PatientAlert[]> {
  if (!hasAccess(tenant, "visits.view")) throw authorizationError();
  await getPatient(tenant, patientId);
  const { data, error } = await tenant.supabase
    .from("patient_alerts")
    .select(COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("patient_id", patientId)
    .order("created_at");
  if (error) throw fromPostgrestError(error);
  return ((data ?? []) as AlertRow[]).map(toAlert);
}

export async function addAlert(
  tenant: Tenant,
  patientId: string,
  alert: AlertPayload,
  requestId?: string,
): Promise<PatientAlert> {
  await getPatient(tenant, patientId);
  const row = await records(tenant).insert(
    { patient_id: patientId, kind: alert.kind, label: alert.label, note: alert.note },
    { requestId },
  );
  return toAlert(row);
}

/** Its name or note, or turning it off — only the fields sent. */
export async function updateAlert(
  tenant: Tenant,
  patientId: string,
  alertId: string,
  changes: UpdateAlertPayload,
  requestId?: string,
): Promise<PatientAlert> {
  const alerts = records(tenant);
  const alert = await alerts.find(alertId);
  if (alert.patient_id !== patientId) throw notFoundError("RECORD_NOT_FOUND");
  return toAlert(await alerts.update(alertId, changes, { requestId }));
}
