import type { ActivityEntry } from "@/features/activity/types";

/** A row of the activity (plan §19): Anu recorded a payment of ₹2,000 by UPI for Meena Iyer, P-1023. */
export function anActivityEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: "a-1",
    action: "CREATE",
    entityType: "payments",
    entityId: "pay-1",
    changes: {
      kind: { from: null, to: "PAYMENT" },
      amount_paise: { from: null, to: 200_000 },
      method: { from: null, to: "UPI" },
      paid_on: { from: null, to: "2026-10-30" },
    },
    at: "2026-10-30T05:12:00.000Z",
    actorName: "Anu Rao",
    patient: { id: "p-1", number: 1023, name: "Meena Iyer" },
    record: { kind: "PAYMENT", amount_paise: 200_000 },
    names: {},
    ...overrides,
  };
}

/** A change from one value to another, as the trail keeps it. */
export const change = (from: unknown, to: unknown) => ({ from, to });
