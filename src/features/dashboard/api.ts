import { HOME_LIST_LIMITS } from "@/constants/limits";
import type { FollowUpKind, PaymentKind, PaymentMethod } from "@/constants/statuses";
import { fromPostgrestError } from "@/lib/errors/fromSupabaseError";
import type { Tenant } from "@/lib/supabase/tenant";

import type { Dashboard, HomePatient } from "./types";

/** A patient as `dashboard_summary` names one. */
interface PatientRow {
  patient_id: string;
  patient_name: string;
  patient_number: number;
}

/** What `dashboard_summary` (0034) hands back: each section, or null without its permission. */
export interface SummaryRow {
  today: string;
  day: { appointments: number; patients_seen: number } | null;
  money: { collected_paise: number; outstanding_paise: number } | null;
  queue:
    | {
        doctor_id: string;
        doctor_name: string;
        with_doctor: number;
        waiting: number;
        next: (PatientRow & { appointment_id: string; token_number: number | null; urgent: boolean })[];
      }[]
    | null;
  to_bill: {
    count: number;
    visits: (PatientRow & { visit_id: string; doctor_name: string | null; token_number: number | null })[];
  } | null;
  follow_ups: {
    today: number;
    overdue: number;
    lapsed: number;
    due: (PatientRow & {
      kind: FollowUpKind;
      treatment_id: string | null;
      visit_id: string | null;
      title: string | null;
      doctor_name: string | null;
    })[];
  } | null;
  upcoming: {
    count: number;
    appointments: (PatientRow & {
      appointment_id: string;
      scheduled_at: string;
      doctor_name: string;
      type_name: string;
    })[];
  } | null;
  owing: (PatientRow & { balance_paise: number })[] | null;
  payments:
    | (PatientRow & {
        payment_id: string;
        kind: PaymentKind;
        amount_paise: number;
        method: PaymentMethod;
        paid_at: string;
      })[]
    | null;
  expenses:
    | {
        expense_id: string;
        category_name: string;
        description: string | null;
        amount_paise: number;
        day: string;
        method: PaymentMethod;
      }[]
    | null;
  getting_started: { prices: boolean; team: boolean } | null;
}

const patientOf = (row: PatientRow): HomePatient => ({
  id: row.patient_id,
  name: row.patient_name,
  number: row.patient_number,
});

/** Home, as the app reads it, from what `dashboard_summary` hands back. */
export function toDashboard(row: SummaryRow): Dashboard {
  return {
    today: row.today,
    day: row.day && { appointments: row.day.appointments, patientsSeen: row.day.patients_seen },
    money: row.money && {
      collectedPaise: row.money.collected_paise,
      outstandingPaise: row.money.outstanding_paise,
    },
    queue:
      row.queue &&
      row.queue.map((doctor) => ({
        doctorId: doctor.doctor_id,
        doctorName: doctor.doctor_name,
        withDoctor: doctor.with_doctor,
        waiting: doctor.waiting,
        next: doctor.next.map((waiting) => ({
          appointmentId: waiting.appointment_id,
          patient: patientOf(waiting),
          token: waiting.token_number,
          urgent: waiting.urgent,
        })),
      })),
    toBill: row.to_bill && {
      count: row.to_bill.count,
      visits: row.to_bill.visits.map((visit) => ({
        visitId: visit.visit_id,
        patient: patientOf(visit),
        doctorName: visit.doctor_name,
        token: visit.token_number,
      })),
    },
    followUps: row.follow_ups && {
      today: row.follow_ups.today,
      overdue: row.follow_ups.overdue,
      lapsed: row.follow_ups.lapsed,
      due: row.follow_ups.due.map((followUp) => ({
        kind: followUp.kind,
        id: (followUp.treatment_id ?? followUp.visit_id)!,
        patient: patientOf(followUp),
        title: followUp.title,
        doctorName: followUp.doctor_name,
      })),
    },
    upcoming: row.upcoming && {
      count: row.upcoming.count,
      appointments: row.upcoming.appointments.map((appointment) => ({
        id: appointment.appointment_id,
        scheduledAt: appointment.scheduled_at,
        patient: patientOf(appointment),
        doctorName: appointment.doctor_name,
        typeName: appointment.type_name,
      })),
    },
    owing: row.owing && row.owing.map((owed) => ({ patient: patientOf(owed), balancePaise: owed.balance_paise })),
    payments:
      row.payments &&
      row.payments.map((payment) => ({
        id: payment.payment_id,
        kind: payment.kind,
        amountPaise: payment.amount_paise,
        method: payment.method,
        paidAt: payment.paid_at,
        patient: patientOf(payment),
      })),
    expenses:
      row.expenses &&
      row.expenses.map((expense) => ({
        id: expense.expense_id,
        categoryName: expense.category_name,
        description: expense.description,
        amountPaise: expense.amount_paise,
        day: expense.day,
        method: expense.method,
      })),
    gettingStarted: row.getting_started,
  };
}

/**
 * Home (plan §17; D345 – D353): every section the caller may see, worked out
 * in SQL (`dashboard_summary`, 0034) with Home's list sizes (D349). One call.
 */
export async function getDashboard(tenant: Tenant): Promise<Dashboard> {
  const { data, error } = await tenant.supabase.rpc("dashboard_summary", {
    p_list_limit: HOME_LIST_LIMITS.list,
    p_queue_limit: HOME_LIST_LIMITS.queue,
  });
  if (error) throw fromPostgrestError(error);
  return toDashboard(data as SummaryRow);
}
