import { hasAccess } from "@/constants/permissions";
import { addPatient } from "@/features/patients/api";
import type { PatientListItem } from "@/features/patients/types";
import { logActionSafe } from "@/lib/audit/auditLog";
import { auditedChanges } from "@/lib/audit/changes";
import { AppError, authorizationError, fromPostgrestError, validationError } from "@/lib/errors";
import { allInOrder } from "@/lib/parallel";
import type { Tenant } from "@/lib/supabase/tenant";
import type { BookedTimesPayload, BookingPayload, CalendarQuery } from "@/lib/validation";

import type { Booked, BookedTime, CalendarAppointment, CalendarAppointmentRow } from "./types";

/**
 * Appointments (plan §11): booked through `create_appointment` — never twice
 * into one doctor's time, never in the past, on a closed day or for an
 * archived patient, once per idempotency key (0017). Audited with their
 * values; their notes by name alone (plan §27.6).
 */
const TABLE = "appointments";

/** The columns a booking is written with, and audited by. */
const WRITTEN = [
  "patient_id",
  "doctor_id",
  "appointment_type_id",
  "scheduled_at",
  "duration_minutes",
  "notes",
] as const;

/**
 * Books an appointment (plan §11.1; D144, D145). A patient added with it is
 * added first, under their own key, and stays added if the booking is
 * refused — the refusal then names them, so the sheet goes on with them
 * found and a booking sent again adds no one twice. Waits on two round trips
 * after the session, three with a new patient: the patient, the booking
 * beside the patient's read-back, the audit rows (plan §37).
 */
export async function bookAppointment(
  tenant: Tenant,
  booking: BookingPayload,
  idempotencyKey: string,
  requestId?: string,
): Promise<Booked> {
  let patientId: string;
  let recorded: Promise<PatientListItem> | null = null;
  if (booking.patient.mode === "FOUND") {
    patientId = booking.patient.id;
  } else {
    if (!hasAccess(tenant, "patients.create")) throw authorizationError();
    if (!booking.patientKey) throw validationError("IDEMPOTENCY_KEY_REQUIRED");
    const added = await addPatient(tenant, booking.patient, booking.patientKey, requestId);
    patientId = added.id;
    recorded = added.recorded;
  }

  const values = {
    patient_id: patientId,
    doctor_id: booking.doctorId,
    appointment_type_id: booking.typeId,
    scheduled_at: booking.scheduledAt,
    duration_minutes: booking.minutes,
    notes: booking.notes,
  };
  const [answer, patient] = await allInOrder([
    tenant.supabase
      .rpc("create_appointment", { p_appointment: values, p_idempotency_key: idempotencyKey })
      .single<{ appointment_id: string; created: boolean }>(),
    recorded,
  ]);
  if (answer.error) {
    const refused = fromPostgrestError(answer.error);
    if (!patient) throw refused;
    throw new AppError({
      kind: refused.kind,
      code: refused.code,
      details: { ...(refused.details as object | undefined), patient },
      cause: answer.error,
    });
  }

  const { appointment_id: id, created } = answer.data;
  if (created) {
    await logActionSafe(tenant, {
      action: "CREATE",
      entityType: TABLE,
      entityId: id,
      changes: auditedChanges(null, values, WRITTEN, ["notes"]),
      requestId,
    });
  }
  return { id, patientId, scheduledAt: booking.scheduledAt, minutes: booking.minutes };
}

/** A doctor's taken times on a day (D147), by time, in one call: never whose they are. */
export async function listBookedTimes(tenant: Tenant, { doctorId, date }: BookedTimesPayload): Promise<BookedTime[]> {
  const { data, error } = await tenant.supabase.rpc("doctor_booked_times", { p_doctor_id: doctorId, p_day: date });
  if (error) throw fromPostgrestError(error);
  return (data as { starts_at: string; ends_at: string }[]).map((row) => ({
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));
}

/** What the calendar reads of each appointment, its patient, its doctor's name and its type's, in one query. */
const CALENDAR_COLUMNS =
  "id, patient_id, doctor_id, source, status, scheduled_at, duration_minutes, local_date, token_number, " +
  "patient:patients!appointments_patient_id_clinic_id_fkey(full_name, patient_number), " +
  "doctor:doctors!appointments_doctor_id_clinic_id_fkey(member:clinic_members(profile:profiles!clinic_members_user_id_fkey(full_name))), " +
  "type:appointment_types!appointments_appointment_type_id_clinic_id_fkey(name)";

/**
 * The calendar's appointments (plan §11.5): those of the days asked — a day
 * or a week — one doctor's or every doctor's, by time, cancelled ones and
 * no-shows too (the screen folds them away, D153). Read as the member, so a
 * doctor finds only their own patients' (D3). One query, served by the index
 * on (clinic_id, local_date, scheduled_at), or with the doctor's.
 */
export async function listAppointments(
  tenant: Tenant,
  { from, to, doctorId }: CalendarQuery,
): Promise<CalendarAppointment[]> {
  let query = tenant.supabase
    .from(TABLE)
    .select(CALENDAR_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .gte("local_date", from)
    .lte("local_date", to);
  if (doctorId) query = query.eq("doctor_id", doctorId);
  const { data, error } = await query.order("scheduled_at");
  if (error) throw fromPostgrestError(error);
  return (data as unknown as CalendarAppointmentRow[]).map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient.full_name,
    patientNumber: row.patient.patient_number,
    doctorId: row.doctor_id,
    doctorName: row.doctor?.member?.profile?.full_name ?? null,
    typeName: row.type.name,
    source: row.source,
    status: row.status,
    scheduledAt: row.scheduled_at,
    minutes: row.duration_minutes,
    day: row.local_date,
    token: row.token_number,
  }));
}
