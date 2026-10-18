import { changedValues } from "@/lib/audit/changes";
import { logActionsSafe } from "@/lib/audit/auditLog";
import type { AuditEntry } from "@/lib/audit/types";
import { fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type { BillPayload, BillStartQuery } from "@/lib/validation";

import { billTotals } from "./totals";
import type { BillIssued, BillStart, BillStartRow } from "./types";

/**
 * Bills (plan §15.2): where a new one starts, and issuing it. Both through
 * one function each — `bill_start` (0030) and `create_bill` (0028, 0029) —
 * which hold `payments.create`, the doctor scope (D3) and, for issuing, the
 * clinic's plan, the prices and the totals.
 */

/**
 * Where a new bill starts (plan §15.2; D285, D302 – D313): a visit, an
 * arrival or a patient, through `bill_start` — reception bills a visit it
 * may not open (its preset holds no `visits.view`), so this reads what billing
 * needs of it. One call; the new bill screen waits on it beside the price
 * list (plan §37).
 */
export async function getBillStart(
  tenant: Tenant,
  { visit, appointment, patient }: BillStartQuery,
): Promise<BillStart> {
  const { data, error } = await tenant.supabase.rpc("bill_start", {
    p_visit_id: visit ?? null,
    p_appointment_id: appointment ?? null,
    p_patient_id: patient ?? null,
  });
  if (error) throw fromPostgrestError(error);
  const row = data as BillStartRow;
  return {
    patient: {
      id: row.patient.id,
      name: row.patient.full_name,
      number: row.patient.patient_number,
      dateOfBirth: row.patient.date_of_birth,
      gender: row.patient.gender,
      archived: row.patient.archived,
    },
    visit: row.visit && {
      id: row.visit.id,
      day: row.visit.visit_date,
      status: row.visit.status,
      billingStatus: row.visit.billing_status,
    },
    appointment: row.appointment && {
      id: row.appointment.id,
      status: row.appointment.status,
      token: row.appointment.token_number,
    },
    doctor: row.doctor && { id: row.doctor.id, name: row.doctor.full_name, feePaise: row.doctor.fee_paise },
    consultationBilled: row.consultation_billed,
    treatments: row.treatments,
    balancePaise: row.balance_paise,
    toBill: row.to_bill && { visitId: row.to_bill.visit_id, day: row.to_bill.visit_date },
  };
}

/** What create_bill hands back. */
interface CreateBillAnswer {
  bill_id: string;
  bill_number: string;
  total_paise: number;
  payment_id: string | null;
  created: boolean;
  visit: { id: string; from: string; to: string } | null;
  balance_paise: number;
}

/** A bill's values in its audit row: none of them clinical. */
const BILL_AUDITED = [
  "bill_number",
  "patient_id",
  "visit_id",
  "appointment_id",
  "subtotal_paise",
  "discount_paise",
  "total_paise",
] as const;

/**
 * A bill issued (plan §15.2): its totals worked out by the one formula
 * (billing/totals.ts) and sent with its lines, the discount and what is
 * collected with it (D282) to `create_bill`, which checks them all again
 * and gives the next number of the financial year — once per idempotency
 * key, however often it is sent. Audited, when it made the bill: the bill's
 * numbers, the payment, and the visit turned Billed. Waits on two round
 * trips after the session: the function, the audit rows (plan §37).
 */
export async function issueBill(
  tenant: Tenant,
  bill: BillPayload,
  idempotencyKey: string,
  requestId?: string,
): Promise<BillIssued> {
  const totals = billTotals(bill.items, bill.discount);
  const { data, error } = await tenant.supabase.rpc("create_bill", {
    p_bill: {
      patient_id: bill.patientId,
      visit_id: bill.visitId,
      appointment_id: bill.appointmentId,
      subtotal_paise: totals.subtotal,
      discount_paise: totals.discount,
      total_paise: totals.total,
      notes: bill.notes,
      items: bill.items.map((item) => ({
        service_id: item.serviceId,
        treatment_id: item.treatmentId,
        description: item.description,
        quantity: item.quantity,
        unit_price_paise: item.unitPricePaise,
      })),
      payment: bill.payment && {
        amount_paise: bill.payment.amountPaise,
        method: bill.payment.method,
        reference: bill.payment.reference,
      },
    },
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw fromPostgrestError(error);
  const answer = data as CreateBillAnswer;
  const collected = answer.payment_id === null ? 0 : bill.payment!.amountPaise;

  if (answer.created) {
    const entries: AuditEntry[] = [
      {
        action: "CREATE",
        entityType: "bills",
        entityId: answer.bill_id,
        changes: changedValues(
          null,
          {
            bill_number: answer.bill_number,
            patient_id: bill.patientId,
            visit_id: bill.visitId,
            appointment_id: bill.appointmentId,
            subtotal_paise: totals.subtotal,
            discount_paise: totals.discount,
            total_paise: totals.total,
          },
          BILL_AUDITED,
        ),
        requestId,
      },
    ];
    if (answer.payment_id !== null) {
      entries.push({
        action: "CREATE",
        entityType: "payments",
        entityId: answer.payment_id,
        changes: changedValues(null, { kind: "PAYMENT", amount_paise: collected, method: bill.payment!.method }, [
          "kind",
          "amount_paise",
          "method",
        ]),
        requestId,
      });
    }
    if (answer.visit !== null) {
      entries.push({
        action: "UPDATE",
        entityType: "visits",
        entityId: answer.visit.id,
        changes: { billing_status: { from: answer.visit.from, to: answer.visit.to } },
        requestId,
      });
    }
    await logActionsSafe(tenant, entries);
  }

  return {
    billId: answer.bill_id,
    billNumber: answer.bill_number,
    totalPaise: answer.total_paise,
    collectedPaise: collected,
    balancePaise: answer.balance_paise,
  };
}
