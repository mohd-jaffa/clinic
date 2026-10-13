import { logActionsSafe } from "@/lib/audit/auditLog";
import type { AuditEntry } from "@/lib/audit/types";
import { fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type {
  NextPatientPayload,
  QueueMovePayload,
  SendInPayload,
  SteppedOutPayload,
  UrgentPayload,
} from "@/lib/validation";

import type { NextPatient, SentIn, SteppedOut, Urgent } from "./types";

/**
 * The queue's moves (plan §11.4; D43, D192 – D198, D201): Send in, Done,
 * Next patient, Back to waiting, Stepped out and Urgent, each one function
 * (0018, 0019) that moves the appointment and opens, closes or removes its
 * visit in one transaction, under the doctor's queue lock. Each hands back what it moved,
 * and each move is audited with its statuses from what to what — the
 * appointment's and the visit's — in one insert. Each waits on two round
 * trips after the session: the move, the audit rows (plan §37).
 */

/** One record a move changed, as its function hands it back: a visit's `from` is none when opened, its `to` when removed. */
interface MoveRow {
  entity: "APPOINTMENT" | "VISIT";
  id: string;
  from: string | null;
  to: string | null;
}

/** The audit trail of a move: each appointment's status change, each visit opened, closed or removed (plan §27.6). */
export function movesAudited(moves: readonly MoveRow[], requestId?: string): AuditEntry[] {
  return moves.map((move) => {
    const status = { status: { from: move.from, to: move.to } };
    if (move.entity === "APPOINTMENT") {
      return { action: "STATUS_CHANGE", entityType: "appointments", entityId: move.id, changes: status, requestId };
    }
    if (move.from === null)
      return { action: "CREATE", entityType: "visits", entityId: move.id, changes: status, requestId };
    if (move.to === null)
      return { action: "DELETE", entityType: "visits", entityId: move.id, changes: status, requestId };
    // Closed, so To bill (D46).
    return {
      action: "STATUS_CHANGE",
      entityType: "visits",
      entityId: move.id,
      changes: { ...status, billing_status: { from: null, to: "TO_BILL" } },
      requestId,
    };
  });
}

/** Runs a move's function, and audits what it moved. */
async function move<Answer extends { moves: MoveRow[] }>(
  tenant: Tenant,
  name: string,
  args: Record<string, unknown>,
  requestId?: string,
): Promise<Answer> {
  const { data, error } = await tenant.supabase.rpc(name, args);
  if (error) throw fromPostgrestError(error);
  const answer = data as Answer;
  await logActionsSafe(tenant, movesAudited(answer.moves, requestId));
  return answer;
}

/**
 * Send in (plan §11.4, D192): any waiting patient, and their visit opens — or
 * the one kept for them continues (D197). While the doctor has someone in,
 * `others` says whether they are marked done first or kept in; without it the
 * move is refused (`DOCTOR_ROOM_TAKEN`), so the desk is asked.
 */
export async function sendIn(
  tenant: Tenant,
  { appointmentId, others }: SendInPayload,
  requestId?: string,
): Promise<SentIn> {
  const answer = await move<{ moves: MoveRow[]; visit_id: string }>(
    tenant,
    "send_in",
    { p_appointment_id: appointmentId, p_others: others ?? null },
    requestId,
  );
  return { visitId: answer.visit_id };
}

/** Done (plan §11.4, D43): the patient in is done, and their visit closes as To bill, whatever was recorded. */
export async function markDone(
  tenant: Tenant,
  { appointmentId }: QueueMovePayload,
  requestId?: string,
): Promise<{ appointmentId: string }> {
  await move(tenant, "mark_done", { p_appointment_id: appointmentId }, requestId);
  return { appointmentId };
}

/**
 * Next patient (D193, D196): the patient it is for — when one is named — is
 * done, and the doctor's lowest waiting token goes in, skipping anyone
 * stepped out (D198). Answers who went in, or no one.
 */
export async function nextPatient(
  tenant: Tenant,
  { doctorId, appointmentId }: NextPatientPayload,
  requestId?: string,
): Promise<NextPatient> {
  const answer = await move<{
    moves: MoveRow[];
    sent: { appointment_id: string; visit_id: string; token: number | null; patient_name: string } | null;
  }>(tenant, "next_patient", { p_doctor_id: doctorId, p_appointment_id: appointmentId ?? null }, requestId);
  const { sent } = answer;
  return {
    sent: sent && {
      appointmentId: sent.appointment_id,
      visitId: sent.visit_id,
      token: sent.token,
      patientName: sent.patient_name,
    },
  };
}

/** Back to waiting (D197): the patient waits again with their token; an empty visit is removed, one with anything recorded kept. */
export async function backToWaiting(
  tenant: Tenant,
  { appointmentId }: QueueMovePayload,
  requestId?: string,
): Promise<{ appointmentId: string }> {
  await move(tenant, "back_to_waiting", { p_appointment_id: appointmentId }, requestId);
  return { appointmentId };
}

/**
 * Stepped out, or back (D198): a waiting patient keeps their token and place,
 * and Next patient skips them while they are away. Audited from when to when,
 * once it changes.
 */
export async function markSteppedOut(
  tenant: Tenant,
  { appointmentId, out }: SteppedOutPayload,
  requestId?: string,
): Promise<SteppedOut> {
  const { data, error } = await tenant.supabase
    .rpc("mark_stepped_out", { p_appointment_id: appointmentId, p_out: out })
    .single<{ stepped_out_at: string | null; previously: string | null }>();
  if (error) throw fromPostgrestError(error);
  if (data.stepped_out_at !== data.previously) {
    await logActionsSafe(tenant, [
      {
        action: "UPDATE",
        entityType: "appointments",
        entityId: appointmentId,
        changes: { stepped_out_at: { from: data.previously, to: data.stepped_out_at } },
        requestId,
      },
    ]);
  }
  return { steppedOutAt: data.stepped_out_at };
}

/**
 * Urgent, or not (D201): a tag on a waiting patient, kept through their
 * visit; Next patient still takes the lowest token. Audited from when to
 * when, once it changes.
 */
export async function markUrgent(
  tenant: Tenant,
  { appointmentId, urgent }: UrgentPayload,
  requestId?: string,
): Promise<Urgent> {
  const { data, error } = await tenant.supabase
    .rpc("mark_urgent", { p_appointment_id: appointmentId, p_urgent: urgent })
    .single<{ urgent_at: string | null; previously: string | null }>();
  if (error) throw fromPostgrestError(error);
  if (data.urgent_at !== data.previously) {
    await logActionsSafe(tenant, [
      {
        action: "UPDATE",
        entityType: "appointments",
        entityId: appointmentId,
        changes: { urgent_at: { from: data.previously, to: data.urgent_at } },
        requestId,
      },
    ]);
  }
  return { urgentAt: data.urgent_at };
}
