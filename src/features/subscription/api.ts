import type { ExtensionKind, PaymentMethod, SubscriptionPlan } from "@/constants/statuses";
import { dayKey, todayKey } from "@/lib/dates/calendar";
import { fromPostgrestError } from "@/lib/errors/fromSupabaseError";
import { allInOrder } from "@/lib/parallel";
import { getPlatformSettings } from "@/lib/platform/settings";
import type { Tenant } from "@/lib/supabase/tenant";

import { standingOf } from "./state";
import type { PlanPayment, PlanView } from "./types";

/** A recorded change to the plan, as `subscription_payments` (0005) holds it. */
export interface PlanPaymentRow {
  id: string;
  plan: ExtensionKind;
  amount_paise: number;
  method: PaymentMethod | null;
  reference: string | null;
  paid_on: string | null;
  valid_until: string;
  reason: string | null;
  receipt_number: string | null;
  created_at: string;
}

const PAYMENT_COLUMNS =
  "id, plan, amount_paise, method, reference, paid_on, valid_until, reason, receipt_number, created_at";

export const toPlanPayment = (row: PlanPaymentRow): PlanPayment => ({
  id: row.id,
  kind: row.plan,
  amountPaise: row.amount_paise,
  method: row.method,
  reference: row.reference,
  paidOn: row.paid_on,
  validUntil: row.valid_until,
  reason: row.reason,
  recordedOn: dayKey(row.created_at),
  receiptNumber: row.receipt_number,
});

/**
 * The owner's Plan screen (plan §7.5; D363 – D366), in one round trip: the
 * plan and every change recorded to it, read as the owner — whom alone RLS
 * lets read them — beside the live settings' prices and renewal contact,
 * read as the server, since no clinic user reads that row. The state is the
 * session's rule, on the clinic's today.
 */
export async function getPlan(tenant: Tenant): Promise<PlanView> {
  const [subscription, payments, settings] = await allInOrder([
    tenant.supabase.from("clinic_subscriptions").select("plan, valid_until").eq("clinic_id", tenant.clinicId).single(),
    tenant.supabase
      .from("subscription_payments")
      .select(PAYMENT_COLUMNS)
      .eq("clinic_id", tenant.clinicId)
      .order("created_at", { ascending: false }),
    getPlatformSettings(),
  ]);
  if (subscription.error) throw fromPostgrestError(subscription.error);
  if (payments.error) throw fromPostgrestError(payments.error);

  const plan = subscription.data as { plan: SubscriptionPlan; valid_until: string };
  const today = todayKey();
  return {
    ...standingOf({ plan: plan.plan, validUntil: plan.valid_until }, settings, today),
    today,
    prices: { monthlyPaise: settings.monthlyPricePaise, yearlyPaise: settings.yearlyPricePaise },
    contact: {
      name: settings.renewalContactName,
      phone: settings.renewalContactPhone,
      email: settings.renewalContactEmail,
      upiId: settings.renewalUpiId,
    },
    payments: (payments.data as PlanPaymentRow[]).map(toPlanPayment),
  };
}
