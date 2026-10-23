import { EARLIER_PAYMENT_HOUR } from "@/constants/limits";
import { hasAccess } from "@/constants/permissions";
import type { Gender, PaymentKind, PaymentMethod, PaymentStatus } from "@/constants/statuses";
import { pageWindow, toPage, type Page } from "@/lib/api/pagination";
import { logActionSafe } from "@/lib/audit/auditLog";
import { changedValues } from "@/lib/audit/changes";
import { dayHour, todayKey } from "@/lib/dates/calendar";
import { rangeBounds } from "@/lib/dates/range";
import { authorizationError, fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type { PageQuery, PaymentPayload, PaymentsQuery, VoidPaymentPayload } from "@/lib/validation";

import type { OutstandingPatient, Payment, PaymentRecorded, PaymentVoided } from "./types";

/**
 * Payments and refunds (plan §15.3, §15.4): recorded and voided through
 * 0029's functions — `record_payment`, `void_payment` — which hold the
 * permission, the doctor scope (D3), the clinic's plan, the archived
 * patient and the balance (D295 – D301); read through their policies
 * (`payments.view`). Who owes is read from the balances they keep.
 */

/** What a payment's row and sheet show of it, in one query: the patient, who took it and who voided it. */
export const PAYMENT_COLUMNS =
  "id, kind, amount_paise, method, reference, paid_at, paid_on, note, status, void_reason, voided_at, " +
  "patient:patients!payments_patient_id_clinic_id_fkey(id, full_name, patient_number, archived_at), " +
  "receiver:profiles!payments_received_by_fkey(full_name), voider:profiles!payments_voided_by_fkey(full_name)";

export interface PaymentRow {
  id: string;
  kind: PaymentKind;
  amount_paise: number;
  method: PaymentMethod;
  reference: string | null;
  paid_at: string;
  paid_on: string;
  note: string | null;
  status: PaymentStatus;
  void_reason: string | null;
  voided_at: string | null;
  patient: { id: string; full_name: string; patient_number: number; archived_at: string | null };
  receiver: { full_name: string } | null;
  voider: { full_name: string } | null;
}

/** A payment as the app shows it. */
export function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    kind: row.kind,
    amountPaise: row.amount_paise,
    method: row.method,
    reference: row.reference,
    paidAt: row.paid_at,
    paidOn: row.paid_on,
    note: row.note,
    status: row.status,
    receivedBy: row.receiver?.full_name ?? null,
    void:
      row.status === "VOID"
        ? { reason: row.void_reason!, at: row.voided_at!, by: row.voider?.full_name ?? null }
        : null,
    patient: {
      id: row.patient.id,
      name: row.patient.full_name,
      number: row.patient.patient_number,
      archived: row.patient.archived_at !== null,
    },
  };
}

/**
 * A page of Billing's Payments tab (plan §15.4; D320, D335): the payments
 * and refunds paid on the days asked, voided ones too, newest first. One
 * query, on the index on (clinic_id, paid_at desc); an earlier day's
 * payment is stamped at its noon (D334), so it falls on its own day.
 */
export async function listPayments(tenant: Tenant, { from, to, cursor }: PaymentsQuery): Promise<Page<Payment>> {
  const bounds = rangeBounds({ from, to });
  const start = cursor ?? 0;
  const window = pageWindow(start);
  const { data, error } = await tenant.supabase
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .gte("paid_at", bounds.from)
    .lt("paid_at", bounds.to)
    .order("paid_at", { ascending: false })
    .order("id", { ascending: false })
    .range(window.from, window.to);
  if (error) throw fromPostgrestError(error);
  return toPage((data as unknown as PaymentRow[]).map(toPayment), start);
}

/** What record_payment hands back. */
interface RecordPaymentAnswer {
  payment_id: string;
  created: boolean;
  balance_paise: number;
}

/**
 * A payment recorded, or a refund (plan §15.3; D297, D299, D322, D334):
 * `payments.create` for a payment, `payments.edit` for a refund — asked
 * here as well as by `record_payment`. Paid today, it is stamped now; an
 * earlier day, at that day's noon in the clinic's timezone (D334). Once per
 * idempotency key; audited when this call recorded it — the kind, amount
 * and method. Waits on two round trips: the function, the audit row.
 */
export async function recordPayment(
  tenant: Tenant,
  payment: PaymentPayload,
  idempotencyKey: string,
  requestId?: string,
): Promise<PaymentRecorded> {
  if (payment.kind === "REFUND" && !hasAccess(tenant, "payments.edit")) throw authorizationError();
  const { data, error } = await tenant.supabase.rpc("record_payment", {
    p_payment: {
      patient_id: payment.patientId,
      kind: payment.kind,
      amount_paise: payment.amountPaise,
      method: payment.method,
      reference: payment.reference,
      paid_at: payment.paidOn === todayKey() ? null : dayHour(payment.paidOn, EARLIER_PAYMENT_HOUR),
      note: payment.note,
    },
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw fromPostgrestError(error);
  const answer = data as RecordPaymentAnswer;
  if (answer.created) {
    await logActionSafe(tenant, {
      action: "CREATE",
      entityType: "payments",
      entityId: answer.payment_id,
      changes: changedValues(
        null,
        { kind: payment.kind, amount_paise: payment.amountPaise, method: payment.method, paid_on: payment.paidOn },
        ["kind", "amount_paise", "method", "paid_on"],
      ),
      requestId,
    });
  }
  return { paymentId: answer.payment_id, balancePaise: answer.balance_paise };
}

/** What void_payment hands back. */
interface VoidPaymentAnswer {
  previously: PaymentStatus;
  balance_paise: number;
}

/**
 * A payment or a refund voided (plan §15.3; D301, D336): `payments.edit`,
 * with a reason, through `void_payment` — once; again changes nothing. It
 * leaves the balance. Audited when this call voided it.
 */
export async function voidPayment(
  tenant: Tenant,
  paymentId: string,
  { reason }: VoidPaymentPayload,
  requestId?: string,
): Promise<PaymentVoided> {
  const { data, error } = await tenant.supabase.rpc("void_payment", { p_payment_id: paymentId, p_reason: reason });
  if (error) throw fromPostgrestError(error);
  const answer = data as VoidPaymentAnswer;
  if (answer.previously === "RECORDED") {
    await logActionSafe(tenant, {
      action: "UPDATE",
      entityType: "payments",
      entityId: paymentId,
      changes: { status: { from: "RECORDED", to: "VOID" }, void_reason: { from: null, to: reason } },
      requestId,
    });
  }
  return { balancePaise: answer.balance_paise };
}

interface OutstandingRow {
  balance_paise: number;
  patient: {
    id: string;
    full_name: string;
    patient_number: number;
    phone: string;
    date_of_birth: string;
    gender: Gender;
    archived_at: string | null;
  };
}

/**
 * A page of Outstanding (plan §15.4; D321): the patients who owe, most
 * first, archived ones too — their balance stays and counts (D300). One
 * query, on the partial index of those who owe.
 */
export async function listOutstanding(tenant: Tenant, { cursor }: PageQuery): Promise<Page<OutstandingPatient>> {
  const start = cursor ?? 0;
  const window = pageWindow(start);
  const { data, error } = await tenant.supabase
    .from("patient_balances")
    .select(
      "balance_paise, patient:patients!patient_balances_patient_id_clinic_id_fkey(id, full_name, patient_number, phone, " +
        "date_of_birth, gender, archived_at)",
    )
    .eq("clinic_id", tenant.clinicId)
    .gt("balance_paise", 0)
    .order("balance_paise", { ascending: false })
    .order("patient_id")
    .range(window.from, window.to);
  if (error) throw fromPostgrestError(error);
  return toPage(
    (data as unknown as OutstandingRow[]).map((row) => ({
      patient: {
        id: row.patient.id,
        name: row.patient.full_name,
        number: row.patient.patient_number,
        phone: row.patient.phone,
        dateOfBirth: row.patient.date_of_birth,
        gender: row.patient.gender,
        archived: row.patient.archived_at !== null,
      },
      balancePaise: row.balance_paise,
    })),
    start,
  );
}

/**
 * A page of a patient's payments and refunds for their history (plan §10.3;
 * D325, D336): newest first, voided ones too, as the member
 * (`payments.view`, the doctor scope). One more than a page, so the history
 * can tell whether more follow. One query, on the index on (clinic_id,
 * patient_id, paid_at desc).
 */
export async function listPatientPayments(tenant: Tenant, patientId: string, start = 0): Promise<Payment[]> {
  const { from, to } = pageWindow(start);
  const { data, error } = await tenant.supabase
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("patient_id", patientId)
    .order("paid_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw fromPostgrestError(error);
  return (data as unknown as PaymentRow[]).map(toPayment);
}

/**
 * A patient's balance (plan §15.4; D295): due when above nothing, an advance
 * below — nothing for one never billed or paid. As the member
 * (`payments.view`, the doctor scope); one query, on its primary key.
 */
export async function getPatientBalance(tenant: Tenant, patientId: string): Promise<number> {
  const { data, error } = await tenant.supabase
    .from("patient_balances")
    .select("balance_paise")
    .eq("clinic_id", tenant.clinicId)
    .eq("patient_id", patientId)
    .maybeSingle<{ balance_paise: number }>();
  if (error) throw fromPostgrestError(error);
  return Number(data?.balance_paise ?? 0);
}
