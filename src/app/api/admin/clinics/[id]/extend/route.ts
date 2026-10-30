import { extendPlan } from "@/features/admin/extend";
import { withDevRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import { readIdempotencyKey } from "@/lib/api/idempotency";
import type { RouteParams } from "@/lib/api/params";
import { extendPlanSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Extend plan (plan §7.4; D373 – D376), the DEV's alone: Monthly, Yearly or
 * Set date, once per Idempotency-Key however often it is sent, and the owner
 * emailed.
 */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withDevRoute(request, async ({ supabase, session, requestId }) =>
    extendPlan(supabase, (await params).id, await readJson(request, extendPlanSchema), readIdempotencyKey(request), {
      requestId,
      userId: session.profile.id,
    }),
  );
}
