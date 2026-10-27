import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { getDashboard } from "@/features/dashboard/api";

export const runtime = "nodejs";

/** Home (plan §17): every section the member may see, each by its own permission (0034). */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.member }, getDashboard);
}
