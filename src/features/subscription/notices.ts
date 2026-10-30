import type { SupabaseClient } from "@supabase/supabase-js";

import { NOTICE_BATCH_SIZE, NOTICE_RUN_MS, NOTICE_SENDS_AT_ONCE } from "@/constants/limits";
import { PLAN_ROUTE } from "@/constants/navigation";
import type { PlatformSettings } from "@/constants/platform";
import type { PlanNotice, SubscriptionPlan } from "@/constants/statuses";
import { captureError } from "@/lib/audit/errorLog";
import { getServerEnv } from "@/lib/env/server";
import { fromPostgrestError } from "@/lib/errors";
import { createConfiguredMailService } from "@/lib/mail/nodemailer.provider";
import { getPlatformSettings } from "@/lib/platform/settings";

/** A plan with a notice due, as `claim_subscription_notices` (0037) hands it back, already marked as told. */
export interface ClaimedNotice {
  clinic_id: string;
  clinic_name: string;
  owner_name: string;
  owner_email: string;
  plan: SubscriptionPlan;
  valid_until: string;
  today: string;
  read_only_from: string;
  notice: PlanNotice;
  due: string;
  previous_notice: PlanNotice | null;
  previous_due: string | null;
  previous_for: string | null;
}

/** How a daily run went: emails sent, and those that did not go — each to be tried again tomorrow. */
export interface NoticesRun {
  sent: number;
  failed: number;
}

async function claim(admin: SupabaseClient): Promise<ClaimedNotice[]> {
  const { data, error } = await admin.rpc("claim_subscription_notices", { p_limit: NOTICE_BATCH_SIZE });
  if (error) throw fromPostgrestError(error);
  return data as ClaimedNotice[];
}

/** Emails one owner their plan's notice (plan §22; D384). Throws when it could not go. */
async function tell(notice: ClaimedNotice, settings: PlatformSettings): Promise<void> {
  await createConfiguredMailService().sendPlanNotice({
    to: notice.owner_email,
    name: notice.owner_name,
    clinicName: notice.clinic_name,
    notice: notice.notice,
    trial: notice.plan === "TRIAL",
    validUntil: notice.valid_until,
    today: notice.today,
    readOnlyFrom: notice.read_only_from,
    renewal: settings,
    planUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}${PLAN_ROUTE}`,
  });
}

/** Sends a batch a few at a time; answers with those that did not go, each logged. */
async function sendAll(batch: ClaimedNotice[], settings: PlatformSettings, requestId: string) {
  const failed: ClaimedNotice[] = [];
  for (let start = 0; start < batch.length; start += NOTICE_SENDS_AT_ONCE) {
    await Promise.all(
      batch.slice(start, start + NOTICE_SENDS_AT_ONCE).map(async (notice) => {
        try {
          await tell(notice, settings);
        } catch (failure) {
          failed.push(notice);
          await captureError({
            message: "Could not send a plan email",
            error: failure,
            clinicId: notice.clinic_id,
            reference: requestId,
            context: { notice: notice.notice },
          });
        }
      }),
    );
  }
  return failed;
}

/**
 * The daily plan emails (plan §22; D382 – D386), as the database's scheduler
 * calls them: plans with a notice due are claimed a batch at a time — marked
 * as told as they are claimed, so a second run at once tells no one twice —
 * and each owner emailed. An email that did not go is released, for the next
 * run to try again (D383). No batch is begun after `NOTICE_RUN_MS`: what is
 * left is due tomorrow still, and caught up then.
 */
export async function sendSubscriptionNotices(admin: SupabaseClient, requestId: string): Promise<NoticesRun> {
  const started = Date.now();
  const [settings, first] = await Promise.all([getPlatformSettings(admin), claim(admin)]);
  const run: NoticesRun = { sent: 0, failed: 0 };
  let batch = first;
  for (;;) {
    const failed = await sendAll(batch, settings, requestId);
    if (failed.length > 0) {
      const { error } = await admin.rpc("release_subscription_notices", { p_claims: failed });
      if (error) throw fromPostgrestError(error);
    }
    run.sent += batch.length - failed.length;
    run.failed += failed.length;
    if (batch.length < NOTICE_BATCH_SIZE || Date.now() - started > NOTICE_RUN_MS) return run;
    batch = await claim(admin);
  }
}
