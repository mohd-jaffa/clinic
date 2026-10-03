import { ROUTE_ACCESS } from "@/constants/permissions";
import { getClinic, updateClinic } from "@/features/clinic/api";
import { withClinicRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import { updateClinicSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** The clinic's profile (plan §9), for any member. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.member }, (tenant) => getClinic(tenant));
}

/** Its details, paper size or fee timing (D78), for `settings.manage`. */
export async function PATCH(request: Request) {
  return withClinicRoute(request, { access: "settings.manage" }, async (context) =>
    updateClinic(context, await readJson(request, updateClinicSchema), context.requestId),
  );
}
