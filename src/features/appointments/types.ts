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
  patient: { full_name: string; patient_number: number };
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
  patient: { full_name: string; patient_number: number; archived_at: string | null };
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
