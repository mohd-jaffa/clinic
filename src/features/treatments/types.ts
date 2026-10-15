import type { TreatmentStatus } from "@/constants/statuses";

/** A doctor as embedded with a row: their member's profile, gone when they left. */
export interface EmbeddedDoctorRow {
  member: { profile: { full_name: string } | null } | null;
}

/** A session as read with its treatment (0024): its visit's day and doctor, and its note. */
export interface TreatmentSessionRow {
  id: string;
  visit_id: string;
  note: string | null;
  created_at: string;
  visit: { visit_date: string; doctor: EmbeddedDoctorRow | null } | null;
}

/** A treatment as read (0024), with its doctor and its sessions. */
export interface TreatmentRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  name: string;
  description: string | null;
  status: TreatmentStatus;
  estimated_cost_paise: number | null;
  started_on: string | null;
  completed_on: string | null;
  next_due_on: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  started_visit_id: string | null;
  created_at: string;
  doctor: EmbeddedDoctorRow | null;
  sessions: TreatmentSessionRow[];
}

/** A visit that worked on a treatment (plan §14.1): its day and doctor, and what was done. */
export interface TreatmentSession {
  id: string;
  visitId: string;
  day: string;
  doctorName: string | null;
  note: string | null;
}

/**
 * A treatment (plan §14.1): a course of care across visits — whose, what,
 * where it stands, its estimated cost (D253), its days, why it was cancelled
 * (D250), the visit it was started in, and its sessions in the order they
 * were recorded.
 */
export interface Treatment {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string | null;
  name: string;
  description: string | null;
  status: TreatmentStatus;
  estimatedCostPaise: number | null;
  startedOn: string | null;
  completedOn: string | null;
  nextDueOn: string | null;
  cancelReason: string | null;
  cancelledOn: string | null;
  startedVisitId: string | null;
  sessions: TreatmentSession[];
}

/** A treatment's details, as the screen read them: what a change is saved from (D251). */
export interface TreatmentDetails {
  name: string;
  description: string | null;
  estimatedCostPaise: number | null;
  nextDueOn: string | null;
  doctorId: string;
}

/** What a treatment's session in a visit saved (D256, D257): its note, and where the treatment stands. */
export interface SessionSaved {
  note: string | null;
  status: TreatmentStatus;
}
