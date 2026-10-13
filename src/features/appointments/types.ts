import type { AppointmentSource, AppointmentStatus } from "@/constants/statuses";

/**
 * What a booking answers (plan §11.1, D150): the appointment, its patient —
 * the one found, or the one added with it — and when it is. The sheet's card
 * is worded from what was chosen; a booker may not read appointments back.
 */
export interface Booked {
  id: string;
  patientId: string;
  scheduledAt: string;
  minutes: number;
}

/** A doctor's taken time on a day (D147): when it starts and ends — never whose it is. */
export interface BookedTime {
  startsAt: string;
  endsAt: string;
}

/** An appointment as the calendar reads it (plan §11.5): who, when, with whom, what kind, and where it stands. */
export interface CalendarAppointment {
  id: string;
  patientId: string;
  patientName: string;
  patientNumber: number;
  /** Their mobile, for a reminder on WhatsApp (D179). */
  patientPhone: string;
  doctorId: string;
  /** None once the doctor's account is gone. */
  doctorName: string | null;
  typeName: string;
  source: AppointmentSource;
  status: AppointmentStatus;
  scheduledAt: string;
  minutes: number;
  /** Its day in the clinic's timezone. */
  day: string;
  token: number | null;
  /** When a reminder was last sent on WhatsApp (D180), or never. */
  remindedAt: string | null;
}

/** An `appointments` row as the calendar reads it, with its patient, doctor and type. */
export interface CalendarAppointmentRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  source: AppointmentSource;
  status: AppointmentStatus;
  scheduled_at: string;
  duration_minutes: number;
  local_date: string;
  token_number: number | null;
  reminded_at: string | null;
  patient: { full_name: string; patient_number: number; phone: string };
  doctor: { member: { profile: { full_name: string } | null } | null } | null;
  type: { name: string };
}

/**
 * One appointment whole, as its detail shows it (plan §11.2, D160): what the
 * calendar reads, and what it says of itself — its notes, who booked it and
 * when, who cancelled it, when and why — and whether its patient is archived,
 * which leaves it read-only (D103).
 */
export interface AppointmentDetail extends CalendarAppointment {
  typeId: string;
  /** Its visit, once sent in (plan §12.1) — read only with `visits.view`. */
  visitId: string | null;
  /** When a waiting patient stepped out (D198), or not. */
  steppedOutAt: string | null;
  patientArchived: boolean;
  notes: string | null;
  bookedAt: string;
  /** None once their account is gone. */
  bookedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
}

/** An `appointments` row as its detail reads it, with its patient, doctor, type and the people who changed it. */
export interface AppointmentDetailRow extends Omit<CalendarAppointmentRow, "patient"> {
  appointment_type_id: string;
  notes: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  patient: { full_name: string; patient_number: number; phone: string; archived_at: string | null };
  stepped_out_at: string | null;
  visit: VisitLink;
  booker: { full_name: string } | null;
  canceller: { full_name: string } | null;
}

/** An appointment in a patient's history (plan §10.3, D167): the calendar's, and why it was cancelled. */
export interface PatientAppointment extends CalendarAppointment {
  cancelReason: string | null;
}

/** What a change answers: the appointment as it now stands — enough for the card that says so. */
export interface AppointmentChanged {
  id: string;
  doctorId: string;
  status: AppointmentStatus;
  scheduledAt: string;
  minutes: number;
}

/** An appointment as today's queue reads it (plan §11.4): the calendar's, and when it arrived, went in and was done. */
export interface QueueAppointment extends CalendarAppointment {
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** When a waiting patient stepped out (D198): Next patient skips them. */
  steppedOutAt: string | null;
  /** Their visit, once sent in — read only with `visits.view` (D195). */
  visitId: string | null;
}

/**
 * An appointment's visit as PostgREST embeds it through the visit's foreign
 * key: one row, or a list of at most one — none when there is no visit, or
 * the member may not read visits.
 */
export type VisitLink = { id: string } | { id: string }[] | null;

/** Send in answered (D192): the visit the patient is in. */
export interface SentIn {
  visitId: string;
}

/** Who Next patient sent in (D196): their appointment, visit, token and name, for the card and the next visit. */
export interface NextSent {
  appointmentId: string;
  visitId: string;
  token: number | null;
  patientName: string;
}

/** Next patient answered: who went in — or no one, with no one waiting. */
export interface NextPatient {
  sent: NextSent | null;
}

/** Stepped out, or back (D198): since when, or not. */
export interface SteppedOut {
  steppedOutAt: string | null;
}

/** What a walk-in or an arrival answers (D173): the appointment, its patient and doctor, and the token given. */
export interface Arrival {
  id: string;
  patientId: string;
  doctorId: string;
  token: number;
}
