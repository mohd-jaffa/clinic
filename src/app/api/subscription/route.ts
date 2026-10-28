import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { getPlan } from "@/features/subscription/api";

export const runtime = "nodejs";

/** The owner's Plan screen (plan §7.5): the plan, the prices, how to renew and its history — read-only included. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.owner }, getPlan);
}
