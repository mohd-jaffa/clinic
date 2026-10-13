import { ALERT_KINDS, type AlertKind } from "@/constants/statuses";
import { fromPostgrestError, notFoundError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";

import type { Visit, VisitRow, VitalsRow } from "./types";
import { toVitals } from "./vitals";

/**
 * Visits (plan §12): opened and closed by the queue's moves
 * (src/features/appointments/moves.ts), read here. Read with `visits.view`,
 * within the doctor scope (D3) — the policies hold it.
 */
const TABLE = "visits";

/**
 * What a visit's screen reads (D195, D202): the visit and what it records,
 * its patient with their alerts, its doctor's name, its token and Urgent,
 * and its vitals.
 */
const VISIT_COLUMNS =
  "id, patient_id, doctor_id, appointment_id, status, visit_date, started_at, completed_at, billing_status, " +
  "complaint, diagnosis, notes, follow_up_on, " +
  "patient:patients!visits_patient_id_clinic_id_fkey(full_name, patient_number, date_of_birth, gender, archived_at, " +
  "alerts:patient_alerts(id, kind, label, note, active)), " +
  "doctor:doctors!visits_doctor_id_clinic_id_fkey(member:clinic_members(profile:profiles!clinic_members_user_id_fkey(full_name))), " +
  "appointment:appointments!visits_appointment_id_clinic_id_fkey(status, token_number, urgent_at), " +
  "vitals:vitals!vitals_visit_id_clinic_id_fkey(systolic, diastolic, pulse, temperature_f, spo2, respiratory_rate, weight_kg, height_cm)";

/** An embedded row, however PostgREST gives it: one, a list of at most one, or none. */
const oneOf = <Row>(embedded: Row | Row[] | null): Row | null =>
  Array.isArray(embedded) ? (embedded[0] ?? null) : embedded;

/** The readings embedded with a visit: none until a vitals row is made. */
const vitalsOf = (embedded: VitalsRow | VitalsRow[] | null) => {
  const row = oneOf(embedded);
  return row === null ? null : toVitals(row);
};

/** Allergies first, then conditions, then medications (plan §12.2). */
const byKind = (a: { kind: AlertKind }, b: { kind: AlertKind }) =>
  ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind);

/**
 * A visit (plan §12.2; D195, D202), in one query: the visit and what it
 * records, its patient and their active alerts, its doctor, its token and its
 * vitals. Read as the member, so a doctor opens only their own patients'
 * (D3), and only with `visits.view`. The visit screen waits on it alone
 * after the session (plan §37).
 */
export async function getVisit(tenant: Tenant, id: string): Promise<Visit> {
  const { data, error } = await tenant.supabase
    .from(TABLE)
    .select(VISIT_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw fromPostgrestError(error);
  if (data === null) throw notFoundError("RECORD_NOT_FOUND");
  const row = data as unknown as VisitRow;
  return {
    id: row.id,
    status: row.status,
    billingStatus: row.billing_status,
    day: row.visit_date,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    patient: {
      id: row.patient_id,
      name: row.patient.full_name,
      number: row.patient.patient_number,
      dateOfBirth: row.patient.date_of_birth,
      gender: row.patient.gender,
      archived: row.patient.archived_at !== null,
    },
    doctorId: row.doctor_id,
    doctorName: row.doctor?.member?.profile?.full_name ?? null,
    appointment:
      row.appointment_id === null || row.appointment === null
        ? null
        : {
            id: row.appointment_id,
            status: row.appointment.status,
            token: row.appointment.token_number,
            urgentAt: row.appointment.urgent_at,
          },
    complaint: row.complaint,
    diagnosis: row.diagnosis,
    notes: row.notes,
    followUpOn: row.follow_up_on,
    vitals: vitalsOf(row.vitals),
    alerts: row.patient.alerts
      .filter((alert) => alert.active)
      .sort(byKind)
      .map(({ id: alertId, kind, label, note, active }) => ({ id: alertId, kind, label, note, active })),
  };
}
