import type { PaymentMethod } from "@/constants/statuses";
import { fromPostgrestError } from "@/lib/errors/fromSupabaseError";
import type { Tenant } from "@/lib/supabase/tenant";
import type { DailyReportQuery, MonthlyReportQuery } from "@/lib/validation";

import type { DailyReport, MonthlyReport, ReportMoney, StatusCounts } from "./types";

interface MoneyRow {
  collected_paise: number;
  billed_paise: number;
  expenses_paise: number;
  net_paise: number;
}

/** What `report_daily` (0034) hands back. */
export interface DailyRow extends MoneyRow {
  day: string;
  patients_seen: number;
  appointments: number;
  statuses: StatusCounts;
  collections: {
    received_by: string | null;
    receiver_name: string | null;
    method: PaymentMethod;
    payments: number;
    received_paise: number;
    refunds: number;
    refunded_paise: number;
  }[];
  voided: { payments: number; payment_paise: number; refunds: number; refund_paise: number };
}

/** What `report_monthly` (0034) hands back. */
export interface MonthlyRow extends MoneyRow {
  month: string;
  patients_seen: number;
  new_patients: number;
  returning_patients: number;
  appointments: number;
  statuses: StatusCounts;
  outstanding_paise: number;
  days: { day: string; collected_paise: number; expenses_paise: number }[];
  doctors: {
    doctor_id: string | null;
    doctor_name: string | null;
    patients_seen: number;
    visits: number;
    billed_paise: number;
    paid_paise: number;
  }[];
}

const moneyOf = (row: MoneyRow): ReportMoney => ({
  collectedPaise: row.collected_paise,
  billedPaise: row.billed_paise,
  expensesPaise: row.expenses_paise,
  netPaise: row.net_paise,
});

/** A day's report, as the app reads it. */
export function toDailyReport(row: DailyRow): DailyReport {
  return {
    day: row.day,
    patientsSeen: row.patients_seen,
    appointments: row.appointments,
    statuses: row.statuses,
    ...moneyOf(row),
    collections: row.collections.map((taken) => ({
      receivedBy: taken.received_by,
      receiverName: taken.receiver_name,
      method: taken.method,
      payments: taken.payments,
      receivedPaise: taken.received_paise,
      refunds: taken.refunds,
      refundedPaise: taken.refunded_paise,
    })),
    voided: {
      payments: row.voided.payments,
      paymentPaise: row.voided.payment_paise,
      refunds: row.voided.refunds,
      refundPaise: row.voided.refund_paise,
    },
  };
}

/** A month's report, as the app reads it. */
export function toMonthlyReport(row: MonthlyRow): MonthlyReport {
  return {
    month: row.month,
    patientsSeen: row.patients_seen,
    newPatients: row.new_patients,
    returningPatients: row.returning_patients,
    appointments: row.appointments,
    statuses: row.statuses,
    ...moneyOf(row),
    outstandingPaise: row.outstanding_paise,
    days: row.days.map((day) => ({
      day: day.day,
      collectedPaise: day.collected_paise,
      expensesPaise: day.expenses_paise,
    })),
    doctors: row.doctors.map((doctor) => ({
      doctorId: doctor.doctor_id,
      doctorName: doctor.doctor_name,
      patientsSeen: doctor.patients_seen,
      visits: doctor.visits,
      billedPaise: doctor.billed_paise,
      paidPaise: doctor.paid_paise,
    })),
  };
}

/**
 * A day's report (plan §18; D49, D345, D346), for `reports.view`: worked out
 * in SQL in the clinic's timezone (`report_daily`, 0034). One call.
 */
export async function getDailyReport(tenant: Tenant, { day }: DailyReportQuery): Promise<DailyReport> {
  const { data, error } = await tenant.supabase.rpc("report_daily", { p_day: day });
  if (error) throw fromPostgrestError(error);
  return toDailyReport(data as DailyRow);
}

/**
 * A month's report (plan §18; D53, D345, D346), for `reports.view`: worked
 * out in SQL in the clinic's timezone (`report_monthly`, 0034). One call.
 */
export async function getMonthlyReport(tenant: Tenant, { month }: MonthlyReportQuery): Promise<MonthlyReport> {
  const { data, error } = await tenant.supabase.rpc("report_monthly", { p_month: month });
  if (error) throw fromPostgrestError(error);
  return toMonthlyReport(data as MonthlyRow);
}
