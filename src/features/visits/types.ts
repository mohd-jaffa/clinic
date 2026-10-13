import type { AlertKind, AppointmentStatus, BillingStatus, Gender, VisitStatus } from "@/constants/statuses";
import type { PatientAlert } from "@/features/patients/types";

/** A visit's readings (plan §12.2), each as taken — or none. Temperature in °F (D31). */
export interface Vitals {
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  temperatureF: number | null;
  spo2: number | null;
  respiratoryRate: number | null;
  weightKg: number | null;
  heightCm: number | null;
}

/** A `vitals` row's readings, as the database names them. */
export interface VitalsRow {
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  temperature_f: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
  weight_kg: number | null;
  height_cm: number | null;
}

/** Complaint, diagnosis and notes (plan §12.2): clinical text, each or none. */
export interface VisitNotes {
  complaint: string | null;
  diagnosis: string | null;
  notes: string | null;
}

/**
 * A visit as its screen shows it (plan §12.2; D195, D202): whose it is — the
 * patient, their doctor, their token — where it stands, whether they are
 * urgent, the patient's active alerts, allergies first, always in view; and
 * what it records — the vitals, complaint, diagnosis, notes and follow-up.
 */
export interface Visit extends VisitNotes {
  id: string;
  status: VisitStatus;
  /** Set once it closes (D46). */
  billingStatus: BillingStatus | null;
  /** Its day in the clinic's timezone. */
  day: string;
  /** When the patient went in — none for a visit opened by their vitals while they wait (D203). */
  startedAt: string | null;
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
   * profile (D204) — and since when it is marked Urgent (D201), or not.
   */
  appointment: { id: string; status: AppointmentStatus; token: number | null; urgentAt: string | null } | null;
  alerts: PatientAlert[];
  /** None until a reading is taken. */
  vitals: Vitals | null;
  /** The day of the next review (D205), or none. */
  followUpOn: string | null;
}

/** A `visits` row as its screen reads it, with its patient and their alerts, its doctor, its appointment and vitals. */
export interface VisitRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  status: VisitStatus;
  visit_date: string;
  started_at: string | null;
  completed_at: string | null;
  billing_status: BillingStatus | null;
  complaint: string | null;
  diagnosis: string | null;
  notes: string | null;
  follow_up_on: string | null;
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
  /** Embedded through the vitals' foreign key: one row, or a list of at most one. */
  vitals: VitalsRow | VitalsRow[] | null;
}

/** Vitals saved (D202, D203): the visit they are on — opened by them, for a patient still waiting — and the readings now. */
export interface VitalsSaved {
  visitId: string;
  vitals: Vitals | null;
}

/** New visit answered (D204): the visit to open, and whether this started it or found one open. */
export interface VisitStarted {
  visitId: string;
  created: boolean;
}
