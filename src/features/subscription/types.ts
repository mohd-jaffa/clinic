import type { ExtensionKind, PaymentMethod } from "@/constants/statuses";

import type { PlanStanding } from "./state";

/** Who a clinic contacts to renew (plan §6, §7.5): each part is null, and not shown, until the DEV sets it. */
export interface RenewalContact {
  name: string | null;
  /** +91 E.164: a Call and a WhatsApp link. */
  phone: string | null;
  email: string | null;
  upiId: string | null;
}

/**
 * One change to the plan's last day, as the DEV recorded it (plan §7.4;
 * D366): money received, or days given or a date put right — at no charge,
 * with the reason given.
 */
export interface PlanPayment {
  id: string;
  kind: ExtensionKind;
  amountPaise: number;
  /** How and when it was paid; null when nothing was. */
  method: PaymentMethod | null;
  reference: string | null;
  paidOn: string | null;
  /** The plan's last day it set. */
  validUntil: string;
  /** Why the date was set by hand. */
  reason: string | null;
  /** The day it was recorded, in the clinic's timezone. */
  recordedOn: string;
  /** Money received has one (D58); its receipt opens from the row (D393). */
  receiptNumber: string | null;
}

/**
 * The owner's Plan screen (plan §7.5): where the plan stands, the prices and
 * how to renew from the live platform settings, and every change recorded,
 * the latest first.
 */
export interface PlanView extends PlanStanding {
  /** The clinic's today, which the state was worked out on. */
  today: string;
  prices: { monthlyPaise: number; yearlyPaise: number };
  contact: RenewalContact;
  payments: PlanPayment[];
}
