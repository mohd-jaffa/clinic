import type { Dashboard } from "@/features/dashboard/types";

/** Home as an owner's day reads it (plan §17): every section, each with something in it. */
export function aDashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  const rohan = { id: "p-1", name: "Rohan Mehta", number: 1001 };
  const meera = { id: "p-2", name: "Meera Pillai", number: 1002 };
  return {
    today: "2026-10-27",
    day: { appointments: 14, patientsSeen: 6 },
    money: { collectedPaise: 1_250_000, outstandingPaise: 320_000 },
    queue: [
      {
        doctorId: "d-1",
        doctorName: "Arun Nair",
        withDoctor: 0,
        waiting: 1,
        next: [{ appointmentId: "a-1", patient: meera, token: 7, urgent: true }],
      },
      { doctorId: "d-2", doctorName: "Maya Rao", withDoctor: 1, waiting: 2, next: [] },
    ],
    toBill: { count: 3, visits: [{ visitId: "v-1", patient: rohan, doctorName: "Maya Rao", token: 4 }] },
    followUps: {
      today: 1,
      overdue: 2,
      lapsed: 1,
      due: [{ kind: "TREATMENT", id: "t-1", patient: meera, title: "Root canal", doctorName: "Maya Rao" }],
    },
    upcoming: {
      count: 1,
      appointments: [
        {
          id: "a-2",
          scheduledAt: "2026-10-28T05:00:00.000Z",
          patient: rohan,
          doctorName: "Maya Rao",
          typeName: "Consultation",
        },
      ],
    },
    owing: [{ patient: rohan, balancePaise: 30_000 }],
    payments: [
      {
        id: "pay-1",
        kind: "PAYMENT",
        amountPaise: 50_000,
        method: "UPI",
        paidAt: "2026-10-27T05:10:00.000Z",
        patient: meera,
      },
    ],
    expenses: [
      {
        id: "e-1",
        categoryName: "Supplies",
        description: "Gauze",
        amountPaise: 25_000,
        day: "2026-10-27",
        method: "CASH",
      },
    ],
    gettingStarted: null,
    ...overrides,
  };
}
