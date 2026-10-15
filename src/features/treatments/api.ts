import { OPEN_TREATMENT_STATUSES, type TreatmentStatus } from "@/constants/statuses";
import { pageWindow, toPage, type Page } from "@/lib/api/pagination";
import { dayKey } from "@/lib/dates/calendar";
import { fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type { FollowUpListQuery } from "@/lib/validation";

import type { FollowUp, FollowUpCounts, FollowUpRow, Treatment, TreatmentRow } from "./types";

/**
 * Treatments (plan §14.1): read with `visits.view`, within the doctor scope
 * (D3) — the policies hold it — with the visit (0025's `visit_treatments`)
 * and the patient's summary; written through ./records. Their next
 * sittings, and visits' follow-ups, are the follow-ups (§14.3): read with
 * `appointments.view` or `visits.view` (D267) through 0026's and 0027's
 * functions, in the clinic's timezone.
 */

/** A doctor's name, as embedded with a row. */
const DOCTOR = "member:clinic_members(profile:profiles!clinic_members_user_id_fkey(full_name))";

/**
 * What a treatment reads (D256, D261): it, its doctor, and its sessions —
 * each with its visit's day and doctor — so its sheet tells its whole story
 * from the row it opened on.
 */
export const TREATMENT_COLUMNS =
  "id, patient_id, doctor_id, name, description, status, estimated_cost_paise, started_on, completed_on, " +
  "next_due_on, cancel_reason, cancelled_at, started_visit_id, created_at, " +
  `doctor:doctors!treatments_doctor_id_clinic_id_fkey(${DOCTOR}), ` +
  "sessions:treatment_sessions!treatment_sessions_treatment_id_clinic_id_fkey(id, visit_id, note, created_at, " +
  `visit:visits!treatment_sessions_visit_id_clinic_id_fkey(visit_date, doctor:doctors!visits_doctor_id_clinic_id_fkey(${DOCTOR})))`;

/** A treatment as the screens hold it: its sessions in the order they were recorded. */
export function toTreatment(row: TreatmentRow): Treatment {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    doctorName: row.doctor?.member?.profile?.full_name ?? null,
    name: row.name,
    description: row.description,
    status: row.status,
    estimatedCostPaise: row.estimated_cost_paise,
    startedOn: row.started_on,
    completedOn: row.completed_on,
    nextDueOn: row.next_due_on,
    cancelReason: row.cancel_reason,
    cancelledOn: row.cancelled_at === null ? null : dayKey(row.cancelled_at),
    startedVisitId: row.started_visit_id,
    sessions: [...row.sessions]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((session) => ({
        id: session.id,
        visitId: session.visit_id,
        day: session.visit?.visit_date ?? dayKey(session.created_at),
        doctorName: session.visit?.doctor?.member?.profile?.full_name ?? null,
        note: session.note,
      })),
  };
}

/** Whether a treatment is still open: not yet completed or cancelled. */
export const isOpen = (status: TreatmentStatus) => (OPEN_TREATMENT_STATUSES as readonly string[]).includes(status);

/**
 * A patient's treatments for their profile (D260): one query, on the index
 * on (clinic_id, patient_id, created_at desc), as the member.
 */
export async function listPatientTreatments(tenant: Tenant, patientId: string): Promise<Treatment[]> {
  const { data, error } = await tenant.supabase
    .from("treatments")
    .select(TREATMENT_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true });
  if (error) throw fromPostgrestError(error);
  return (data as unknown as TreatmentRow[]).map(toTreatment);
}

/** A follow-up as the screen holds it. */
export function toFollowUp(row: FollowUpRow): FollowUp {
  return {
    kind: row.kind,
    id: (row.treatment_id ?? row.visit_id)!,
    patient: { id: row.patient_id, name: row.patient_name, number: row.patient_number, phone: row.patient_phone },
    title: row.title,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    dueOn: row.due_on,
    lastContact:
      row.last_outcome === null
        ? null
        : { outcome: row.last_outcome, at: row.last_contacted_at!, note: row.last_note, by: row.last_contacted_by },
  };
}

/**
 * A page of one of the follow-ups' tabs (plan §14.3; D267 – D271): through
 * 0027's `follow_up_items`, as the caller — so a doctor finds only their own —
 * in the clinic's timezone, the earliest due first, Completed the latest
 * completed first. One query.
 */
export async function listFollowUps(tenant: Tenant, { tab, cursor }: FollowUpListQuery): Promise<Page<FollowUp>> {
  const start = cursor ?? 0;
  const { from, to } = pageWindow(start);
  const { data, error } = await tenant.supabase.rpc("follow_up_items", {
    p_tab: tab,
    p_offset: from,
    p_limit: to - from + 1,
  });
  if (error) throw fromPostgrestError(error);
  return toPage((data as FollowUpRow[]).map(toFollowUp), start);
}

/** How many each tab holds (plan §14.3), snoozed ones left out (D271): 0026's `follow_up_counts`, one query. */
export async function countFollowUps(tenant: Tenant): Promise<FollowUpCounts> {
  const { data, error } = await tenant.supabase.rpc("follow_up_counts");
  if (error) throw fromPostgrestError(error);
  return Object.fromEntries(
    (data as { tab: string; total: number }[]).map(({ tab, total }) => [tab, Number(total)]),
  ) as FollowUpCounts;
}
