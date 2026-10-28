import type { PlanPayment, PlanView } from "@/features/subscription/types";

/** A month paid for by UPI, recorded on the day it was paid. */
export function aPlanPayment(overrides: Partial<PlanPayment> = {}): PlanPayment {
  return {
    id: "sp-1",
    kind: "MONTHLY",
    amountPaise: 30_000,
    method: "UPI",
    reference: "UPI-4821",
    paidOn: "2026-10-12",
    validUntil: "2026-11-12",
    reason: null,
    recordedOn: "2026-10-12",
    ...overrides,
  };
}

/** The owner's Plan screen on 27 Oct (plan §7.5): a Monthly plan to 12 Nov, the contact set, one month paid. */
export function aPlan(overrides: Partial<PlanView> = {}): PlanView {
  return {
    plan: "MONTHLY",
    validUntil: "2026-11-12",
    state: "ACTIVE",
    readOnlyFrom: "2026-11-20",
    today: "2026-10-27",
    prices: { monthlyPaise: 30_000, yearlyPaise: 300_000 },
    contact: { name: "Jaffa", phone: "+919845012345", email: "renew@clinicdesk.in", upiId: "clinicdesk@okaxis" },
    payments: [aPlanPayment()],
    ...overrides,
  };
}
