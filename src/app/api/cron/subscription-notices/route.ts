import { sendSubscriptionNotices } from "@/features/subscription/notices";
import { requireCronSecret } from "@/lib/api/cron";
import { withApiHandler } from "@/lib/api/handler";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
// Room for a full run (NOTICE_RUN_MS) and the emails of its last batch.
export const maxDuration = 60;

/**
 * The daily plan emails (plan §22; D382), called by the database's scheduler
 * through pg_net with CRON_SECRET — and by no one else. Answers with how many
 * went, and how many will be tried again.
 */
export async function POST(request: Request) {
  return withApiHandler(request, async ({ requestId }) => {
    requireCronSecret(request);
    return sendSubscriptionNotices(createSupabaseServiceRoleClient(), requestId);
  });
}
