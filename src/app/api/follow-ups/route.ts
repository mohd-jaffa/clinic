import { FOLLOW_UP_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { listFollowUps } from "@/features/treatments/api";
import { readQuery } from "@/lib/api/handler";
import { followUpListQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A page of one of the follow-ups' tabs (plan §14.3), for `appointments.view`
 * or `visits.view` (D267): a doctor's own patients only.
 */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: FOLLOW_UP_ACCESS.list }, (tenant) =>
    listFollowUps(tenant, readQuery(request, followUpListQuerySchema)),
  );
}
