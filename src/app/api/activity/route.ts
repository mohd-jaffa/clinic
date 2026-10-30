import { ROUTE_ACCESS } from "@/constants/permissions";
import { listActivity } from "@/features/activity/api";
import { withClinicRoute } from "@/features/auth/guard";
import { readQuery } from "@/lib/api/handler";
import { activityQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A page of the clinic's activity (plan §19), kept to a person and a kind — the owner's alone, a view-only clinic's too. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.owner }, (tenant) =>
    listActivity(tenant, readQuery(request, activityQuerySchema)),
  );
}
