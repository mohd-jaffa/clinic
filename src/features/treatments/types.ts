import type { FollowUpKind, FollowUpOutcome, FollowUpTab, TreatmentStatus } from "@/constants/statuses";

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

/** A follow-up as 0027's `follow_up_items` hands it back. */
export interface FollowUpRow {
  kind: FollowUpKind;
  treatment_id: string | null;
  visit_id: string | null;
  patient_id: string;
  patient_name: string;
  patient_number: number;
  patient_phone: string;
  title: string | null;
  doctor_id: string;
  doctor_name: string | null;
  due_on: string;
  last_outcome: FollowUpOutcome | null;
  last_contacted_at: string | null;
  last_note: string | null;
  last_contacted_by: string | null;
}

/** The last contact about a follow-up (D275): how it went, when, its note, and who made it. */
export interface FollowUpContact {
  outcome: FollowUpOutcome;
  at: string;
  note: string | null;
  by: string | null;
}

/**
 * A follow-up in its tab (plan §14.3; D267): whose, what is due — a
 * treatment's next sitting, by its name, or a visit's follow-up — with which
 * doctor and when, and the last contact; nothing more of the record. `id` is
 * its treatment's or its visit's.
 */
export interface FollowUp {
  kind: FollowUpKind;
  id: string;
  patient: { id: string; name: string; number: number; phone: string };
  /** The treatment's name; null for a visit's follow-up. */
  title: string | null;
  doctorId: string;
  doctorName: string | null;
  /** The day it is due — on Completed, the day the treatment was completed. */
  dueOn: string;
  lastContact: FollowUpContact | null;
}

/** How many each tab holds (plan §14.3), snoozed ones left out (D271). */
export type FollowUpCounts = Record<FollowUpTab, number>;

/** A contact noted (D271, D273): which, about whom, how it went, and the day it is out of the lists until. */
export interface ContactNoted {
  id: string;
  patientId: string;
  outcome: FollowUpOutcome;
  snoozeUntil: string | null;
}
