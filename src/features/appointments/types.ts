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
