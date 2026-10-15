import { FOLLOW_UP_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { countFollowUps } from "@/features/treatments/api";

export const runtime = "nodejs";

/** How many each of the follow-ups' tabs holds (plan §14.3), for `appointments.view` or `visits.view` (D267). */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: FOLLOW_UP_ACCESS.list }, (tenant) => countFollowUps(tenant));
}
