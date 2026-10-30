import type { SupabaseClient } from "@supabase/supabase-js";

import { PLAN_ROUTE } from "@/constants/navigation";
import { captureError } from "@/lib/audit/errorLog";
import { getServerEnv } from "@/lib/env/server";
import { fromPostgrestError } from "@/lib/errors";
import { createConfiguredMailService } from "@/lib/mail/nodemailer.provider";
import type { ExtendPlanPayload } from "@/lib/validation";

import { toClinicDetail, type ClinicDetailRow } from "./api";
import type { ConsoleClinicDetail, ConsolePlanPayment, PlanExtended } from "./types";

/** What `extend_clinic_subscription` (0036) hands back: whether this call recorded it, and the clinic after. */
interface ExtendedRow {
  created: boolean;
  payment: { id: string };
  clinic: ClinicDetailRow;
}

/** Plan extended (plan §22; D375): the owner is told the new last day and what was recorded. Throws when it could not go. */
async function emailOwner(clinic: ConsoleClinicDetail, payment: ConsolePlanPayment): Promise<void> {
  await createConfiguredMailService().sendPlanExtended({
    to: clinic.owner.email,
    name: clinic.owner.name,
    clinicName: clinic.name,
    kind: payment.kind,
    validFrom: payment.validFrom,
    validUntil: payment.validUntil,
    amountPaise: payment.amountPaise,
    method: payment.method,
    paidOn: payment.paidOn,
    receiptNumber: payment.receiptNumber,
    reason: payment.reason,
    planUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}${PLAN_ROUTE}`,
  });
}

/**
 * Extend plan (plan §7.4; D373 – D376), as the DEV — with their own client,
 * so the database checks the role itself. One call records the change, its
 * receipt, the new last day and the platform audit row, and answers with the
 * clinic as it now stands; then the owner is emailed, every time (D376). A
 * failed email never undoes the extension: it is logged, and the answer says
 * so. The same Extend plan sent again records nothing and emails no one.
 */
export async function extendPlan(
  developer: SupabaseClient,
  clinicId: string,
  extension: ExtendPlanPayload,
  idempotencyKey: string,
  { requestId, userId }: { requestId: string; userId: string },
): Promise<PlanExtended> {
  const { data, error } = await developer.rpc("extend_clinic_subscription", {
    p_clinic_id: clinicId,
    p_kind: extension.kind,
    p_amount_paise: extension.amountPaise,
    p_method: extension.method,
    p_reference: extension.reference,
    p_paid_on: extension.paidOn,
    p_valid_until: extension.validUntil,
    p_reason: extension.reason,
    p_idempotency_key: idempotencyKey,
    p_request_id: requestId,
  });
  if (error) throw fromPostgrestError(error);
  const row = data as ExtendedRow;
  const clinic = toClinicDetail(row.clinic);
  const payment = clinic.payments.find((each) => each.id === row.payment.id)!;
  if (!row.created) return { clinic, payment, emailSent: null };

  try {
    await emailOwner(clinic, payment);
    return { clinic, payment, emailSent: true };
  } catch (failure) {
    await captureError({
      message: "Could not send a plan extended email",
      error: failure,
      userId,
      clinicId,
      reference: requestId,
    });
    return { clinic, payment, emailSent: false };
  }
}
