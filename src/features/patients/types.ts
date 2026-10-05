import type { AlertKind, Gender } from "@/constants/statuses";

/** A patient as the database reads them (0015), with their doctor's name and who archived them. */
export interface PatientRow {
  id: string;
  patient_number: number;
  full_name: string;
  phone: string;
  alt_phone: string | null;
  email: string | null;
  date_of_birth: string;
  dob_is_estimated: boolean;
  gender: Gender;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  assigned_doctor_id: string | null;
  notes: string | null;
  archived_at: string | null;
  doctor: { member: { profile: { full_name: string } | null } | null } | null;
  archiver: { full_name: string } | null;
}

/** A patient (plan §10.1), as the screens read them. */
export interface Patient {
  id: string;
  /** 1001; shown as P-1001. */
  number: number;
  name: string;
  /** +91 and ten digits. */
  phone: string;
  altPhone: string | null;
  email: string | null;
  dateOfBirth: string;
  /** Worked out from an age (D100): shown as an age, never as a birthday. */
  dobIsEstimated: boolean;
  gender: Gender;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  assignedDoctorId: string | null;
  doctorName: string | null;
  notes: string | null;
  /** When they were archived (D103), or null while they are not. */
  archivedAt: string | null;
  /** Who archived them, while their profile lasts. */
  archivedBy: string | null;
}

/** One of the patients "Already here?" lists for a mobile (D106). */
export interface PatientMatch {
  id: string;
  number: number;
  name: string;
  dateOfBirth: string;
  gender: Gender;
  archived: boolean;
}

/** A row of the patients list (plan §10.2): who, and the number to call. */
export interface PatientListItem {
  id: string;
  number: number;
  name: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
}

/** An alert as the database holds it (plan §10.4). */
export interface AlertRow {
  id: string;
  patient_id: string;
  kind: AlertKind;
  label: string;
  note: string | null;
  active: boolean;
}

/** An alert as the screens read it: an allergy, a condition or a medication. */
export interface PatientAlert {
  id: string;
  kind: AlertKind;
  label: string;
  note: string | null;
  active: boolean;
}

/** What a patient import may hold (D128), and how many rows each request sends. */
export interface ImportLimits {
  maxRows: number;
  batchSize: number;
}

/** One of the clinic's patients on a mobile an import's row has (plan §10.5). */
export interface ImportMatch {
  phone: string;
  number: number;
  name: string;
}

/** What one request of an import did: its rows, all now patients, and how many of them it added. */
export interface ImportResult {
  imported: number;
  added: number;
}
