import { pageWindow, toPage, type Page } from "@/lib/api/pagination";
import { logActionSafe } from "@/lib/audit/auditLog";
import type { BillingStatus } from "@/constants/statuses";
import { fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type { NoChargePayload, ToBillCountQuery, ToBillQuery } from "@/lib/validation";

import type { NoChargeMarked, ToBillCount, ToBillVisit } from "./types";

/**
 * Checkout (plan §15.6; D46, D318, D319, D337): the visits waiting in To
 * bill, how many, and No charge. Reception checks out visits it may not
 * open, so the list is read through `to_bill_visits` (0031) for
 * `payments.view`, and No charge is `mark_no_charge` (0028) for
 * `payments.create`.
 */

/** What to_bill_visits hands back for a visit. */
interface ToBillRow {
  visit_id: string;
  visit_date: string;
  completed_at: string | null;
  patient_id: string;
  patient_name: string;
  patient_number: number;
  patient_archived: boolean;
  doctor_id: string | null;
  doctor_name: string | null;
  appointment_id: string | null;
  token_number: number | null;
  treatments: string[];
  fee_paid: boolean;
}

/**
 * A page of To bill (plan §15.6; D318): the visits waiting, from any day,
 * oldest done first — one doctor's, or every doctor's — within the doctor
 * scope. One more than a page, so it knows whether another follows. One call.
 */
export async function listToBill(tenant: Tenant, { doctorId, cursor }: ToBillQuery): Promise<Page<ToBillVisit>> {
  const start = cursor ?? 0;
  const window = pageWindow(start);
  const { data, error } = await tenant.supabase.rpc("to_bill_visits", {
    p_doctor_id: doctorId ?? null,
    p_offset: window.from,
    p_limit: window.to - window.from + 1,
  });
  if (error) throw fromPostgrestError(error);
  return toPage(
    ((data ?? []) as ToBillRow[]).map((row) => ({
      visitId: row.visit_id,
      day: row.visit_date,
      completedAt: row.completed_at,
      patient: {
        id: row.patient_id,
        name: row.patient_name,
        number: row.patient_number,
        archived: row.patient_archived,
      },
      doctor: row.doctor_id === null ? null : { id: row.doctor_id, name: row.doctor_name },
      appointmentId: row.appointment_id,
      token: row.token_number,
      treatments: row.treatments,
      feePaid: row.fee_paid,
    })),
    start,
  );
}

/** How many wait in To bill (D337) — one doctor's, or every doctor's. One call. */
export async function countToBill(tenant: Tenant, { doctorId }: ToBillCountQuery): Promise<ToBillCount> {
  const { data, error } = await tenant.supabase.rpc("to_bill_count", { p_doctor_id: doctorId ?? null });
  if (error) throw fromPostgrestError(error);
  return { count: data as number };
}

/**
 * A visit waiting in To bill settled free (plan §15.6; D319): a reason —
 * Review, Courtesy, or Other with a note — through `mark_no_charge`; again
 * changes nothing. Audited when this call marked it. A bill issued for it
 * later makes it Billed (D287).
 */
export async function markNoCharge(
  tenant: Tenant,
  visitId: string,
  { reason, note }: NoChargePayload,
  requestId?: string,
): Promise<NoChargeMarked> {
  const { data, error } = await tenant.supabase
    .rpc("mark_no_charge", { p_visit_id: visitId, p_reason: reason, p_note: note })
    .single<{ previously: BillingStatus | null }>();
  if (error) throw fromPostgrestError(error);
  if (data.previously === "TO_BILL") {
    await logActionSafe(tenant, {
      action: "UPDATE",
      entityType: "visits",
      entityId: visitId,
      changes: {
        billing_status: { from: "TO_BILL", to: "NO_CHARGE" },
        no_charge_reason: { from: null, to: reason },
      },
      requestId,
    });
  }
  return { visitId };
}
