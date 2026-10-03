import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { addClosure, listClosures } from "@/features/clinic/closures";
import { readJson } from "@/lib/api/handler";
import { closureSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Holidays and leave (plan §9), past ones too, for any member: the calendar and booking read them. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.member }, (tenant) => listClosures(tenant));
}

/** A new holiday or leave (D85, D86), for `settings.manage`. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "settings.manage", successStatus: 201 }, async (context) =>
    addClosure(context, await readJson(request, closureSchema), context.requestId),
  );
}
