import type { DailyReport, MonthlyReport } from "@/features/reports/types";

/** A day's report, as an owner's busy Tuesday reads (plan §18). */
export function aDailyReport(overrides: Partial<DailyReport> = {}): DailyReport {
  return {
    day: "2026-10-27",
    patientsSeen: 9,
    appointments: 12,
    statuses: { COMPLETED: 9, CANCELLED: 2, NO_SHOW: 1, ARRIVED: 2 },
    collectedPaise: 1_250_000,
    billedPaise: 1_480_000,
    expensesPaise: 250_000,
    netPaise: 1_000_000,
    collections: [
      {
        receivedBy: "user-2",
        receiverName: "Priya Nair",
        method: "CASH",
        payments: 4,
        receivedPaise: 1_250_000,
        refunds: 0,
        refundedPaise: 0,
      },
    ],
    voided: { payments: 0, paymentPaise: 0, refunds: 0, refundPaise: 0 },
    ...overrides,
  };
}

/** October's report: three days for the chart, and its doctors. */
export function aMonthlyReport(overrides: Partial<MonthlyReport> = {}): MonthlyReport {
  return {
    month: "2026-10-01",
    patientsSeen: 140,
    newPatients: 38,
    returningPatients: 102,
    appointments: 186,
    statuses: { COMPLETED: 160, SCHEDULED: 6, CONFIRMED: 4, NO_SHOW: 8, CANCELLED: 12 },
    collectedPaise: 32_000_000,
    billedPaise: 35_500_000,
    expensesPaise: 9_000_000,
    netPaise: 23_000_000,
    outstandingPaise: 1_200_000,
    days: [
      { day: "2026-10-01", collectedPaise: 1_200_000, expensesPaise: 900_000 },
      { day: "2026-10-02", collectedPaise: 0, expensesPaise: 0 },
      { day: "2026-10-03", collectedPaise: 400_000, expensesPaise: 0 },
    ],
    doctors: [
      {
        doctorId: "d-1",
        doctorName: "Maya Rao",
        patientsSeen: 80,
        visits: 95,
        billedPaise: 20_000_000,
        paidPaise: 18_000_000,
      },
      { doctorId: null, doctorName: null, patientsSeen: 0, visits: 0, billedPaise: 300_000, paidPaise: 300_000 },
    ],
    ...overrides,
  };
}
