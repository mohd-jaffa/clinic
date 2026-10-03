import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { services } from "@/features/clinic/catalogues";
import { readJson } from "@/lib/api/handler";
import { serviceSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** The price list (plan §9, D82), archived entries too, for any member: the bill reads it. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.member }, (tenant) => services.list(tenant));
}

/** A new service on the price list, for `settings.manage`. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "settings.manage", successStatus: 201 }, async (context) =>
    services.add(context, await readJson(request, serviceSchema), context.requestId),
  );
}
