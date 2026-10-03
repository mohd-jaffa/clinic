import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { listDoctors } from "@/features/team/api";

export const runtime = "nodejs";

/** The clinic's active doctors, for every picker (plan §30): any member reads them. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.member }, (tenant) => listDoctors(tenant));
}
