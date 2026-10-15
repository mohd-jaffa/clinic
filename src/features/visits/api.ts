import { ALERT_KINDS, type AlertKind } from "@/constants/statuses";
import { fromEmbedded, fromPrevious } from "@/features/prescriptions/content";
import type { EmbeddedPrescriptionRow } from "@/features/prescriptions/types";
import { pageWindow } from "@/lib/api/pagination";
import { fromPostgrestError, notFoundError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";

import type { PatientVisit, PatientVisitRow, Visit, VisitRow, VitalsRow } from "./types";
import { toVitals } from "./vitals";

/**
 * Visits (plan §12): opened and closed by the queue's moves
 * (src/features/appointments/moves.ts), read here. Read with `visits.view`,
 * within the doctor scope (D3) — the policies hold it.
 */
const TABLE = "visits";

/**
 * What a visit's screen reads (D195, D202): the visit and what it records,
 * its patient with their mobile (to send the prescription to, D244) and alerts, its doctor's name and registration number
 * (D213), its token and Urgent, its vitals, its prescription with who typed
 * it (D45), and the patient's prescription before it, for Repeat (D236).
 */
const VISIT_COLUMNS =
  "id, patient_id, doctor_id, appointment_id, status, visit_date, started_at, completed_at, billing_status, " +
  "complaint, diagnosis, notes, follow_up_on, " +
  "patient:patients!visits_patient_id_clinic_id_fkey(full_name, patient_number, phone, date_of_birth, gender, archived_at, " +
  "alerts:patient_alerts(id, kind, label, note, active)), " +
  "doctor:doctors!visits_doctor_id_clinic_id_fkey(registration_number, " +
  "member:clinic_members(user_id, profile:profiles!clinic_members_user_id_fkey(full_name))), " +
  "appointment:appointments!visits_appointment_id_clinic_id_fkey(status, token_number, urgent_at), " +
  "vitals:vitals!vitals_visit_id_clinic_id_fkey(systolic, diastolic, pulse, temperature_f, spo2, respiratory_rate, weight_kg, height_cm), " +
  "prescription:prescriptions!prescriptions_visit_id_clinic_id_fkey(id, advice, print_diagnosis, entered_by, " +
  "typist:profiles!prescriptions_entered_by_fkey(full_name), " +
  "items:prescription_items(position, medicine, strength, dose, frequency, timing, duration_days, instructions)), " +
  "previous:previous_prescription";

/**
 * What a patient's history reads of each visit (D225, D226): its day, where
 * it stands, its doctor, what it found, its medicines' names, and whether it
 * holds anything (`visit_recorded`).
 */
const HISTORY_COLUMNS =
  "id, status, visit_date, created_at, complaint, diagnosis, recorded:visit_recorded, " +
  "doctor:doctors!visits_doctor_id_clinic_id_fkey(member:clinic_members(profile:profiles!clinic_members_user_id_fkey(full_name))), " +
  "prescription:prescriptions!prescriptions_visit_id_clinic_id_fkey(items:prescription_items(position, medicine))";

/** An embedded row, however PostgREST gives it: one, a list of at most one, or none. */
const oneOf = <Row>(embedded: Row | Row[] | null): Row | null =>
  Array.isArray(embedded) ? (embedded[0] ?? null) : embedded;

/** The readings embedded with a visit: none until a vitals row is made. */
const vitalsOf = (embedded: VitalsRow | VitalsRow[] | null) => {
  const row = oneOf(embedded);
  return row === null ? null : toVitals(row);
};

/** The prescription embedded with a visit: none until one is saved. */
const prescriptionOf = (
  embedded: EmbeddedPrescriptionRow | EmbeddedPrescriptionRow[] | null,
  doctorUserId: string | null,
) => {
  const row = oneOf(embedded);
  return row === null ? null : fromEmbedded(row, doctorUserId);
};

/** Allergies first, then conditions, then medications (plan §12.2). */
const byKind = (a: { kind: AlertKind }, b: { kind: AlertKind }) =>
  ALERT_KINDS.indexOf(a.kind) - ALERT_KINDS.indexOf(b.kind);

/**
 * A visit (plan §12.2; D195, D202), in one query: the visit and what it
 * records, its patient and their active alerts, its doctor, its token, its
 * vitals, its prescription (plan §13) and the one before it (D236). Read as the member, so a doctor opens only their own patients'
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
      phone: row.patient.phone,
      dateOfBirth: row.patient.date_of_birth,
      gender: row.patient.gender,
      archived: row.patient.archived_at !== null,
    },
    doctorId: row.doctor_id,
    doctorName: row.doctor?.member?.profile?.full_name ?? null,
    doctorRegistration: row.doctor?.registration_number ?? null,
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
    prescription: prescriptionOf(row.prescription, row.doctor?.member?.user_id ?? null),
    previousPrescription: row.previous === null ? null : fromPrevious(row.previous),
    alerts: row.patient.alerts
      .filter((alert) => alert.active)
      .sort(byKind)
      .map(({ id: alertId, kind, label, note, active }) => ({ id: alertId, kind, label, note, active })),
  };
}

/**
 * A page of a patient's visits for their history (plan §10.3, D225): newest
 * first, as the member — `visits.view`, a doctor's own patients (D3) — one
 * more than a page, so the history can tell whether more follow. One query,
 * on the index on (clinic_id, patient_id, created_at desc, id desc).
 */
export async function listPatientVisits(tenant: Tenant, patientId: string, start = 0): Promise<PatientVisit[]> {
  const { from, to } = pageWindow(start);
  const { data, error } = await tenant.supabase
    .from(TABLE)
    .select(HISTORY_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw fromPostgrestError(error);
  return (data as unknown as PatientVisitRow[]).map((row) => ({
    id: row.id,
    status: row.status,
    day: row.visit_date,
    openedAt: row.created_at,
    doctorName: row.doctor?.member?.profile?.full_name ?? null,
    finding: row.diagnosis ?? row.complaint,
    medicines: [...(oneOf(row.prescription)?.items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => item.medicine),
    recorded: row.recorded,
  }));
}
