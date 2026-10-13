import type { PostgrestError } from "@supabase/supabase-js";

import { hasAccess } from "@/constants/permissions";
import type { AppointmentStatus } from "@/constants/statuses";
import { addPatient } from "@/features/patients/api";
import type { PatientListItem } from "@/features/patients/types";
import { pageWindow, toPage, type Page } from "@/lib/api/pagination";
import { logActionSafe } from "@/lib/audit/auditLog";
import { auditedChanges } from "@/lib/audit/changes";
import { todayKey } from "@/lib/dates/calendar";
import { AppError, authorizationError, fromPostgrestError, notFoundError, validationError } from "@/lib/errors";
import { allInOrder } from "@/lib/parallel";
import type { Tenant } from "@/lib/supabase/tenant";
import type {
  AppointmentChangePayload,
  BookedTimesPayload,
  BookingPayload,
  CalendarQuery,
  QueueQuery,
  StatusChangePayload,
  WalkInPayload,
} from "@/lib/validation";

import type {
  AppointmentChanged,
  AppointmentDetail,
  AppointmentDetailRow,
  Arrival,
  Booked,
  BookedTime,
  CalendarAppointment,
  CalendarAppointmentRow,
  PatientAppointment,
  QueueAppointment,
  VisitLink,
} from "./types";

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
 * The patient a booking or a walk-in is for (D144, D145): one found, or one
 * added first under their own key — with `patients.create` — whose read-back
 * runs beside what follows.
 */
async function patientFor(
  tenant: Tenant,
  patient: BookingPayload["patient"],
  patientKey: string | undefined,
  requestId?: string,
): Promise<{ patientId: string; recorded: Promise<PatientListItem> | null }> {
  if (patient.mode === "FOUND") return { patientId: patient.id, recorded: null };
  if (!hasAccess(tenant, "patients.create")) throw authorizationError();
  if (!patientKey) throw validationError("IDEMPOTENCY_KEY_REQUIRED");
  const added = await addPatient(tenant, patient, patientKey, requestId);
  return { patientId: added.id, recorded: added.recorded };
}

/**
 * Why a booking or a walk-in was refused, in its own words — naming the
 * patient added before it, who stays added, so the sheet goes on with them
 * found and sent again adds no one twice (D145).
 */
function refusedWith(error: PostgrestError, patient: PatientListItem | null): AppError {
  const refused = fromPostgrestError(error);
  if (!patient) return refused;
  return new AppError({
    kind: refused.kind,
    code: refused.code,
    details: { ...(refused.details as object | undefined), patient },
    cause: error,
  });
}

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
  const { patientId, recorded } = await patientFor(tenant, booking.patient, booking.patientKey, requestId);
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
  if (answer.error) throw refusedWith(answer.error, patient);

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

/** What a walk-in is written with, and audited by. */
const WALKED_IN = ["patient_id", "doctor_id", "appointment_type_id", "token_number"] as const;

/**
 * Adds a walk-in (plan §11.3; D139, D171) through `add_walk_in`: arrived at
 * now, its type's length, the doctor's next token of the day — refused on a
 * closed day like a booking. A patient added with it is added first, as a
 * booking's is. Once per idempotency key; audited with its values and its
 * token. Answers the token, to tell the patient (D173). Waits on the round
 * trips a booking does.
 */
export async function addWalkIn(
  tenant: Tenant,
  walkIn: WalkInPayload,
  idempotencyKey: string,
  requestId?: string,
): Promise<Arrival> {
  const { patientId, recorded } = await patientFor(tenant, walkIn.patient, walkIn.patientKey, requestId);
  const values = { patient_id: patientId, doctor_id: walkIn.doctorId, appointment_type_id: walkIn.typeId };
  const [answer, patient] = await allInOrder([
    tenant.supabase
      .rpc("add_walk_in", { p_walk_in: values, p_idempotency_key: idempotencyKey })
      .single<{ appointment_id: string; token_number: number; created: boolean }>(),
    recorded,
  ]);
  if (answer.error) throw refusedWith(answer.error, patient);

  const { appointment_id: id, token_number: token, created } = answer.data;
  if (created) {
    await logActionSafe(tenant, {
      action: "CREATE",
      entityType: TABLE,
      entityId: id,
      changes: auditedChanges(null, { ...values, token_number: token }, WALKED_IN),
      requestId,
    });
  }
  return { id, patientId, doctorId: walkIn.doctorId, token };
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

/** What every read of an appointment holds, beside its patient: its own columns, its doctor's name and its type's. */
const OWN_COLUMNS =
  "id, patient_id, doctor_id, source, status, scheduled_at, duration_minutes, local_date, token_number, reminded_at";
const DOCTOR_AND_TYPE =
  "doctor:doctors!appointments_doctor_id_clinic_id_fkey(member:clinic_members(profile:profiles!clinic_members_user_id_fkey(full_name))), " +
  "type:appointment_types!appointments_appointment_type_id_clinic_id_fkey(name)";
const PATIENT = "patient:patients!appointments_patient_id_clinic_id_fkey";
/** An appointment's visit (plan §12.1), through the visit's foreign key — read as the member, so only with `visits.view`. */
const VISIT = "visit:visits!visits_appointment_id_clinic_id_fkey(id)";

/** The id of an appointment's visit, however PostgREST embedded it. */
export const visitIdOf = (visit: VisitLink): string | null =>
  Array.isArray(visit) ? (visit[0]?.id ?? null) : (visit?.id ?? null);

/** What the calendar reads of each appointment, its patient, its doctor's name and its type's, in one query. */
const CALENDAR_COLUMNS = `${OWN_COLUMNS}, ${PATIENT}(full_name, patient_number, phone), ${DOCTOR_AND_TYPE}`;

/** An appointment in a patient's history (D167): the calendar's, and why it was cancelled. */
const HISTORY_COLUMNS = `${CALENDAR_COLUMNS}, cancel_reason`;

/** An appointment's detail (D160): the calendar's, what it says of itself, and who booked and cancelled it. */
const DETAIL_COLUMNS =
  `${OWN_COLUMNS}, appointment_type_id, notes, created_at, cancelled_at, cancel_reason, ` +
  `${PATIENT}(full_name, patient_number, phone, archived_at), ${DOCTOR_AND_TYPE}, ` +
  "booker:profiles!appointments_created_by_fkey(full_name), canceller:profiles!appointments_cancelled_by_fkey(full_name), " +
  `stepped_out_at, ${VISIT}`;

/** A row as the calendar reads it, in the shape every screen holds. */
function toCalendarAppointment(row: CalendarAppointmentRow): CalendarAppointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient.full_name,
    patientNumber: row.patient.patient_number,
    patientPhone: row.patient.phone,
    doctorId: row.doctor_id,
    doctorName: row.doctor?.member?.profile?.full_name ?? null,
    typeName: row.type.name,
    source: row.source,
    status: row.status,
    scheduledAt: row.scheduled_at,
    minutes: row.duration_minutes,
    day: row.local_date,
    token: row.token_number,
    remindedAt: row.reminded_at,
  };
}

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
  return (data as unknown as CalendarAppointmentRow[]).map(toCalendarAppointment);
}

/**
 * One appointment's detail (plan §11.2, D160), in one query: the calendar's,
 * its notes, who booked it and when, who cancelled it, when and why, and
 * whether its patient is archived. Read as the member, so a doctor opens only
 * their own patients' (D3).
 */
export async function getAppointment(tenant: Tenant, id: string): Promise<AppointmentDetail> {
  const { data, error } = await tenant.supabase
    .from(TABLE)
    .select(DETAIL_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw fromPostgrestError(error);
  if (data === null) throw notFoundError("RECORD_NOT_FOUND");
  const row = data as unknown as AppointmentDetailRow;
  return {
    ...toCalendarAppointment(row),
    typeId: row.appointment_type_id,
    patientArchived: row.patient.archived_at !== null,
    notes: row.notes,
    bookedAt: row.created_at,
    bookedBy: row.booker?.full_name ?? null,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.canceller?.full_name ?? null,
    cancelReason: row.cancel_reason,
    visitId: visitIdOf(row.visit),
    steppedOutAt: row.stepped_out_at,
  };
}

/** What a change to an appointment is audited by: its own fields, and its status, which a move may set back (D142). */
const CHANGED = ["doctor_id", "appointment_type_id", "scheduled_at", "duration_minutes", "notes", "status"] as const;

interface ChangedRow {
  id: string;
  doctor_id: string;
  appointment_type_id: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
  status: AppointmentStatus;
}

const toChanged = (row: ChangedRow): AppointmentChanged => ({
  id: row.id,
  doctorId: row.doctor_id,
  status: row.status,
  scheduledAt: row.scheduled_at,
  minutes: row.duration_minutes,
});

/** The appointment as it stands before a change, for the audit row's "from" — read as the member. */
async function standing(tenant: Tenant, id: string): Promise<ChangedRow> {
  const { data, error } = await tenant.supabase
    .from(TABLE)
    .select(`id, ${CHANGED.join(", ")}`)
    .eq("clinic_id", tenant.clinicId)
    .eq("id", id)
    .maybeSingle<ChangedRow>();
  if (error) throw fromPostgrestError(error);
  if (data === null) throw notFoundError("RECORD_NOT_FOUND");
  return data;
}

/**
 * Changes an appointment (plan §11.1, D161) through `update_appointment`: its
 * notes alone, at any time — or moved to another doctor, day, time, type or
 * length, only a booking not yet arrived, under every rule a booking keeps.
 * A confirmed one moved to another time or doctor is scheduled again (D142).
 * Audited with its values from what to what, its notes by name alone. Waits
 * on three round trips after the session: the appointment as it stands, the
 * change, the audit row (plan §37).
 */
export async function changeAppointment(
  tenant: Tenant,
  id: string,
  changes: AppointmentChangePayload,
  requestId?: string,
): Promise<AppointmentChanged> {
  const before = await standing(tenant, id);
  const values =
    "scheduledAt" in changes
      ? {
          doctor_id: changes.doctorId,
          appointment_type_id: changes.typeId,
          scheduled_at: changes.scheduledAt,
          duration_minutes: changes.minutes,
          notes: changes.notes,
        }
      : { notes: changes.notes };
  const { data, error } = await tenant.supabase
    .rpc("update_appointment", { p_appointment_id: id, p_changes: values })
    .single<ChangedRow>();
  if (error) throw fromPostgrestError(error);
  const changed = auditedChanges(before, data, CHANGED, ["notes"]);
  if (Object.keys(changed).length > 0) {
    await logActionSafe(tenant, { action: "UPDATE", entityType: TABLE, entityId: id, changes: changed, requestId });
  }
  return toChanged(data);
}

/**
 * Sets an appointment's status from its detail (plan §11.2) through
 * `change_appointment_status`: confirmed, back to scheduled or a no-show with
 * `appointments.edit`; cancelled, with its reason, with `appointments.cancel`
 * (D162). The same status sent twice changes nothing more. Audited as a
 * status change from what to what, the reason by name alone. Waits on three
 * round trips after the session, as a change does.
 */
export async function changeAppointmentStatus(
  tenant: Tenant,
  id: string,
  { status, reason }: StatusChangePayload,
  requestId?: string,
): Promise<AppointmentChanged> {
  if (!hasAccess(tenant, status === "CANCELLED" ? "appointments.cancel" : "appointments.edit")) {
    throw authorizationError();
  }
  const before = await standing(tenant, id);
  const cancelling = status === "CANCELLED";
  const { data, error } = await tenant.supabase
    .rpc("change_appointment_status", {
      p_appointment_id: id,
      p_status: status,
      p_reason: cancelling ? reason : null,
    })
    .single<ChangedRow>();
  if (error) throw fromPostgrestError(error);
  if (data.status !== before.status) {
    await logActionSafe(tenant, {
      action: "STATUS_CHANGE",
      entityType: TABLE,
      entityId: id,
      changes: { status: { from: before.status, to: data.status }, ...(cancelling && { fields: ["cancel_reason"] }) },
      requestId,
    });
  }
  return toChanged(data);
}

/**
 * A booked patient at the desk (plan §11.3; D141, D143) through
 * `mark_arrived`: on the appointment's own day, with the doctor's next token —
 * or the one they already hold today. Audited as a status change, with the
 * token. Answers the token, to tell the patient (D173). Waits on three round
 * trips after the session, as a status change does.
 */
export async function markArrived(tenant: Tenant, id: string, requestId?: string): Promise<Arrival> {
  const before = await standing(tenant, id);
  const { data, error } = await tenant.supabase
    .rpc("mark_arrived", { p_appointment_id: id })
    .single<ChangedRow & { patient_id: string; token_number: number }>();
  if (error) throw fromPostgrestError(error);
  if (data.status !== before.status) {
    await logActionSafe(tenant, {
      action: "STATUS_CHANGE",
      entityType: TABLE,
      entityId: id,
      changes: {
        status: { from: before.status, to: data.status },
        token_number: { from: null, to: data.token_number },
      },
      requestId,
    });
  }
  return { id, patientId: data.patient_id, doctorId: data.doctor_id, token: data.token_number };
}

/**
 * A reminder sent on WhatsApp (plan §22.1; D180, D184) through
 * `mark_reminded`: stamped now, for a booking still to come. Audited from
 * when it was last sent to now. Waits on two round trips after the session:
 * the stamp, the audit row.
 */
export async function markReminded(tenant: Tenant, id: string, requestId?: string): Promise<{ remindedAt: string }> {
  const { data, error } = await tenant.supabase
    .rpc("mark_reminded", { p_appointment_id: id })
    .single<{ reminded_at: string; previously: string | null }>();
  if (error) throw fromPostgrestError(error);
  await logActionSafe(tenant, {
    action: "UPDATE",
    entityType: TABLE,
    entityId: id,
    changes: { reminded_at: { from: data.previously, to: data.reminded_at } },
    requestId,
  });
  return { remindedAt: data.reminded_at };
}

/** What today's queue holds (plan §11.4): those still to come, arrived, with a doctor, and done — none cancelled. */
const QUEUE_STATUSES: readonly AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED"];

/** An appointment in the queue: the calendar's, when it arrived, went in and was done, whether it stepped out, and its visit. */
const QUEUE_COLUMNS = `${CALENDAR_COLUMNS}, arrived_at, started_at, completed_at, stepped_out_at, ${VISIT}`;

/**
 * Today's queue (plan §11.4; D168, D170): today's appointments still to come,
 * arrived, with a doctor or done — and anyone still with a doctor from a day
 * before, who heads it — one doctor's or every doctor's, by time. Read as the
 * member, so a doctor finds only their own patients' (D3). One query, served
 * by the index on (clinic_id, local_date, scheduled_at) — or the doctor's —
 * and the partial one on those in progress; each one's visit, for those who
 * may read visits, by the visit's unique appointment.
 */
export async function listQueue(tenant: Tenant, { doctorId }: QueueQuery): Promise<QueueAppointment[]> {
  let query = tenant.supabase
    .from(TABLE)
    .select(QUEUE_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .or(`local_date.eq.${todayKey()},status.eq.IN_PROGRESS`)
    .in("status", QUEUE_STATUSES);
  if (doctorId) query = query.eq("doctor_id", doctorId);
  const { data, error } = await query.order("scheduled_at");
  if (error) throw fromPostgrestError(error);
  return (
    data as unknown as (CalendarAppointmentRow & {
      arrived_at: string | null;
      started_at: string | null;
      completed_at: string | null;
      stepped_out_at: string | null;
      visit: VisitLink;
    })[]
  ).map((row) => ({
    ...toCalendarAppointment(row),
    arrivedAt: row.arrived_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    steppedOutAt: row.stepped_out_at,
    visitId: visitIdOf(row.visit),
  }));
}

/** What a patient may still come for (D140): booked, confirmed, arrived or under way, today or later. */
const STILL_TO_COME: readonly AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "ARRIVED", "IN_PROGRESS"];

/**
 * A patient's next appointment (plan §10.3, D166): the soonest still to come,
 * today or later — or none. One query, on the index on (clinic_id,
 * patient_id, scheduled_at).
 */
export async function nextAppointment(tenant: Tenant, patientId: string): Promise<CalendarAppointment | null> {
  const { data, error } = await tenant.supabase
    .from(TABLE)
    .select(CALENDAR_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("patient_id", patientId)
    .in("status", STILL_TO_COME)
    .gte("local_date", todayKey())
    .order("scheduled_at")
    .limit(1)
    .maybeSingle();
  if (error) throw fromPostgrestError(error);
  return data === null ? null : toCalendarAppointment(data as unknown as CalendarAppointmentRow);
}

/**
 * A page of a patient's appointments (plan §10.3, D167): every one, newest
 * first — those still to come, then the past, cancelled ones and no-shows
 * too, with their reason. One query, on the index on (clinic_id, patient_id,
 * scheduled_at desc).
 */
export async function listPatientAppointments(
  tenant: Tenant,
  patientId: string,
  start = 0,
): Promise<Page<PatientAppointment>> {
  const { from, to } = pageWindow(start);
  const { data, error } = await tenant.supabase
    .from(TABLE)
    .select(HISTORY_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("patient_id", patientId)
    .order("scheduled_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw fromPostgrestError(error);
  const rows = data as unknown as (CalendarAppointmentRow & { cancel_reason: string | null })[];
  return toPage(
    rows.map((row) => ({ ...toCalendarAppointment(row), cancelReason: row.cancel_reason })),
    start,
  );
}
