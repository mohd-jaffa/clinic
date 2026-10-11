import { hasAccess } from "@/constants/permissions";
import { addPatient } from "@/features/patients/api";
import type { PatientListItem } from "@/features/patients/types";
import { logActionSafe } from "@/lib/audit/auditLog";
import { auditedChanges } from "@/lib/audit/changes";
import { AppError, authorizationError, fromPostgrestError, validationError } from "@/lib/errors";
import { allInOrder } from "@/lib/parallel";
import type { Tenant } from "@/lib/supabase/tenant";
import type { BookedTimesPayload, BookingPayload } from "@/lib/validation";

import type { Booked, BookedTime } from "./types";

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
