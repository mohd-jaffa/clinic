import type { AlertKind, AppointmentStatus, BillingStatus, Gender, VisitStatus } from "@/constants/statuses";
import type { PatientAlert } from "@/features/patients/types";

/**
 * A visit as its screen's header shows it (plan §12.2, D195): whose it is —
 * the patient, their doctor, their token — where it stands, whether they are
 * urgent, and the patient's active alerts, allergies first, always in view.
 */
export interface VisitHeader {
  id: string;
  status: VisitStatus;
  /** Set once it closes (D46). */
  billingStatus: BillingStatus | null;
  /** Its day in the clinic's timezone. */
  day: string;
  startedAt: string;
  completedAt: string | null;
  patient: {
    id: string;
    name: string;
    number: number;
    dateOfBirth: string;
    gender: Gender;
    archived: boolean;
  };
  doctorId: string;
  /** None once the doctor's account is gone. */
  doctorName: string | null;
  /**
   * The appointment it was opened for — none for a visit started from a
   * profile (R6.2) — and since when it is marked Urgent (D201), or not.
   */
  appointment: { id: string; status: AppointmentStatus; token: number | null; urgentAt: string | null } | null;
  alerts: PatientAlert[];
}

/** A `visits` row as its header reads it, with its patient and their alerts, its doctor and its appointment. */
export interface VisitHeaderRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  status: VisitStatus;
  visit_date: string;
  started_at: string;
  completed_at: string | null;
  billing_status: BillingStatus | null;
  patient: {
    full_name: string;
    patient_number: number;
    date_of_birth: string;
    gender: Gender;
    archived_at: string | null;
    alerts: { id: string; kind: AlertKind; label: string; note: string | null; active: boolean }[];
  };
  doctor: { member: { profile: { full_name: string } | null } | null } | null;
  appointment: { status: AppointmentStatus; token_number: number | null; urgent_at: string | null } | null;
}
