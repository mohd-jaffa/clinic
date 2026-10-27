import type { AppointmentStatus, PaymentMethod } from "@/constants/statuses";

/** How many of a day's or a month's appointments stand in each status; a status with none is absent. */
export type StatusCounts = Partial<Record<AppointmentStatus, number>>;

/** The money of a day or a month (plan §18; D345): voided bills and payments out of their own day. */
export interface ReportMoney {
  /** Payments less refunds. */
  collectedPaise: number;
  /** Bills issued. */
  billedPaise: number;
  expensesPaise: number;
  /** Collected less expenses. */
  netPaise: number;
}

/** What one person took, and handed back, by one method on a day (D49). */
export interface Collection {
  /** None for someone no longer on the team. */
  receivedBy: string | null;
  receiverName: string | null;
  method: PaymentMethod;
  payments: number;
  receivedPaise: number;
  refunds: number;
  refundedPaise: number;
}

/** A day's report (plan §18; `report_daily`, 0034). */
export interface DailyReport extends ReportMoney {
  day: string;
  patientsSeen: number;
  /** Every booking and walk-in but the cancelled (D346). */
  appointments: number;
  statuses: StatusCounts;
  /** The day-end collection summary (D49). */
  collections: Collection[];
  /** The day's payments and refunds voided since. */
  voided: { payments: number; paymentPaise: number; refunds: number; refundPaise: number };
}

/** One doctor's month (D53); no doctor for the bills that name none. */
export interface DoctorMonth {
  doctorId: string | null;
  doctorName: string | null;
  patientsSeen: number;
  visits: number;
  billedPaise: number;
  /** Of what was billed, what is paid to date. */
  paidPaise: number;
}

/** A month's report (plan §18; `report_monthly`, 0034). */
export interface MonthlyReport extends ReportMoney {
  /** Its first day. */
  month: string;
  patientsSeen: number;
  newPatients: number;
  returningPatients: number;
  appointments: number;
  statuses: StatusCounts;
  outstandingPaise: number;
  /** Each day of the month, for the chart (D354). */
  days: { day: string; collectedPaise: number; expensesPaise: number }[];
  doctors: DoctorMonth[];
}
