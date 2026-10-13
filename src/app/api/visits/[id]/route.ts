import { withClinicRoute } from "@/features/auth/guard";
import { getVisit } from "@/features/visits/api";
import type { RouteParams } from "@/lib/api/params";

export const runtime = "nodejs";

/** A visit's header (plan §12.2, D195), for `visits.view` — a doctor's own patients' only (D3). */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.view" }, async (tenant) => getVisit(tenant, (await params).id));
}
