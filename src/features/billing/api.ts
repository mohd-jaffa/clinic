import { changedValues } from "@/lib/audit/changes";
import { logActionsSafe } from "@/lib/audit/auditLog";
import type { AuditEntry } from "@/lib/audit/types";
import type { BillListState, BillPaymentState, BillStatus, Gender } from "@/constants/statuses";
import { pageWindow, toPage, type Page } from "@/lib/api/pagination";
import { rangeBounds } from "@/lib/dates/range";
import { fromPostgrestError, notFoundError } from "@/lib/errors";
import { allInOrder } from "@/lib/parallel";
import { oneOf } from "@/lib/supabase/embedded";
import type { Tenant } from "@/lib/supabase/tenant";
import type { BillPayload, BillsQuery, BillStartQuery, VoidBillPayload } from "@/lib/validation";

import { billTotals } from "./totals";
import type { BillDetail, BillIssued, BillListItem, BillStart, BillStartRow, BillVoided } from "./types";

/**
 * Bills (plan §15.2): where a new one starts, issuing it, reading it and
 * voiding it. Each write through one function — `bill_start` (0030),
 * `create_bill` (0028, 0029), `void_bill` — which hold the permission, the
 * doctor scope (D3), the clinic's plan, the prices and the totals; a bill is
 * read through its policies (`payments.view`).
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

/** What a bill's page reads of it, in one query: its patient — with their balance — doctor, lines and people. */
const BILL_COLUMNS =
  "id, bill_number, issued_at, issued_on, status, visit_id, appointment_id, subtotal_paise, discount_paise, " +
  "total_paise, notes, void_reason, voided_at, " +
  "patient:patients!bills_patient_id_clinic_id_fkey(id, full_name, patient_number, phone, date_of_birth, gender, " +
  "archived_at, balance:patient_balances!patient_balances_patient_id_clinic_id_fkey(balance_paise)), " +
  "doctor:doctors!bills_doctor_id_clinic_id_fkey(member:clinic_members(profile:profiles!clinic_members_user_id_fkey(full_name))), " +
  "items:bill_items(position, description, quantity, unit_price_paise, amount_paise, service_id, treatment_id), " +
  "issuer:profiles!bills_created_by_fkey(full_name), voider:profiles!bills_voided_by_fkey(full_name)";

interface BillRow {
  id: string;
  bill_number: string;
  issued_at: string;
  issued_on: string;
  status: BillStatus;
  visit_id: string | null;
  appointment_id: string | null;
  subtotal_paise: number;
  discount_paise: number;
  total_paise: number;
  notes: string | null;
  void_reason: string | null;
  voided_at: string | null;
  patient: {
    id: string;
    full_name: string;
    patient_number: number;
    phone: string;
    date_of_birth: string;
    gender: Gender;
    archived_at: string | null;
    balance: { balance_paise: number } | { balance_paise: number }[] | null;
  };
  doctor: { member: { profile: { full_name: string } | null } | null } | null;
  items: {
    position: number;
    description: string;
    quantity: number;
    unit_price_paise: number;
    amount_paise: number;
    service_id: string | null;
    treatment_id: string | null;
  }[];
  issuer: { full_name: string } | null;
  voider: { full_name: string } | null;
}

interface SettlementRow {
  paid_paise: number;
  due_paise: number;
  state: BillPaymentState;
}

/**
 * A bill for its page and its PDF (plan §15.2, §15.5; D314): the bill with
 * its patient, doctor, lines and people in one query, beside where it stands
 * with payment (`bill_settlement`, D298) — two at once, one round trip after
 * the session. Within `payments.view`, the doctor scope and the clinic;
 * one not found or not theirs is the same refusal.
 */
export async function getBill(tenant: Tenant, billId: string): Promise<BillDetail> {
  const [billRead, settlementRead] = await allInOrder([
    tenant.supabase.from("bills").select(BILL_COLUMNS).eq("clinic_id", tenant.clinicId).eq("id", billId).maybeSingle(),
    tenant.supabase
      .from("bill_settlement")
      .select("paid_paise, due_paise, state")
      .eq("clinic_id", tenant.clinicId)
      .eq("bill_id", billId)
      .maybeSingle(),
  ]);
  if (billRead.error) throw fromPostgrestError(billRead.error);
  if (settlementRead.error) throw fromPostgrestError(settlementRead.error);
  if (billRead.data === null) throw notFoundError("RECORD_NOT_FOUND");
  const row = billRead.data as unknown as BillRow;
  const settlement = settlementRead.data as SettlementRow | null;
  return {
    id: row.id,
    number: row.bill_number,
    issuedAt: row.issued_at,
    issuedOn: row.issued_on,
    status: row.status,
    patient: {
      id: row.patient.id,
      name: row.patient.full_name,
      number: row.patient.patient_number,
      phone: row.patient.phone,
      dateOfBirth: row.patient.date_of_birth,
      gender: row.patient.gender,
      archived: row.patient.archived_at !== null,
    },
    visitId: row.visit_id,
    appointmentId: row.appointment_id,
    doctor: row.doctor?.member?.profile?.full_name ?? null,
    lines: [...row.items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPricePaise: item.unit_price_paise,
        amountPaise: item.amount_paise,
        serviceId: item.service_id,
        treatmentId: item.treatment_id,
      })),
    subtotalPaise: row.subtotal_paise,
    discountPaise: row.discount_paise,
    totalPaise: row.total_paise,
    notes: row.notes,
    issuedBy: row.issuer?.full_name ?? null,
    void:
      row.status === "VOID"
        ? { reason: row.void_reason!, at: row.voided_at!, by: row.voider?.full_name ?? null }
        : null,
    settlement: settlement && {
      paidPaise: settlement.paid_paise,
      duePaise: settlement.due_paise,
      state: settlement.state,
    },
    balancePaise: oneOf(row.patient.balance)?.balance_paise ?? 0,
  };
}

/** What void_bill hands back. */
interface VoidBillAnswer {
  previously: BillStatus;
  visit: { id: string; from: string; to: string } | null;
  balance_paise: number;
}

/**
 * A bill voided (plan §15.2; D314): `payments.edit`, with a reason, through
 * `void_bill` — once; voiding it again changes nothing. It leaves the
 * balance, and its visit returns to To bill once nothing billed remains for
 * it (D286). Audited when it voided it: the bill's status and reason, and
 * the visit's move. Waits on two round trips after the session.
 */
export async function voidBill(
  tenant: Tenant,
  billId: string,
  { reason }: VoidBillPayload,
  requestId?: string,
): Promise<BillVoided> {
  const { data, error } = await tenant.supabase.rpc("void_bill", { p_bill_id: billId, p_reason: reason });
  if (error) throw fromPostgrestError(error);
  const answer = data as VoidBillAnswer;
  if (answer.previously === "ISSUED") {
    const entries: AuditEntry[] = [
      {
        action: "UPDATE",
        entityType: "bills",
        entityId: billId,
        changes: { status: { from: "ISSUED", to: "VOID" }, void_reason: { from: null, to: reason } },
        requestId,
      },
    ];
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
  return { balancePaise: answer.balance_paise, visitToBill: answer.visit !== null };
}

/** What list_bills (0031) answers for a bill. */
interface BillListRow {
  id: string;
  bill_number: string;
  issued_at: string;
  total_paise: number;
  patient_id: string;
  patient_name: string;
  patient_number: number;
  paid_paise: number | null;
  due_paise: number | null;
  state: BillListState;
}

/**
 * A page of Billing's Bills tab (plan §15.4; D320, D335): the bills issued
 * on the days asked, newest first, each with its patient and where it
 * stands — and only those in a state, when one is asked — through
 * `list_bills`, as the caller (`payments.view`, the doctor scope). One more
 * than a page, so it knows whether another follows. One call.
 */
export async function listBills(tenant: Tenant, { from, to, state, cursor }: BillsQuery): Promise<Page<BillListItem>> {
  const bounds = rangeBounds({ from, to });
  const start = cursor ?? 0;
  const window = pageWindow(start);
  const { data, error } = await tenant.supabase.rpc("list_bills", {
    p_from: bounds.from,
    p_to: bounds.to,
    p_state: state ?? null,
    p_offset: window.from,
    p_limit: window.to - window.from + 1,
  });
  if (error) throw fromPostgrestError(error);
  return toPage(
    ((data ?? []) as BillListRow[]).map((row) => ({
      id: row.id,
      number: row.bill_number,
      issuedAt: row.issued_at,
      totalPaise: row.total_paise,
      patient: { id: row.patient_id, name: row.patient_name, number: row.patient_number },
      settlement: row.state === "VOID" ? null : { paidPaise: Number(row.paid_paise), duePaise: Number(row.due_paise) },
      state: row.state,
    })),
    start,
  );
}
