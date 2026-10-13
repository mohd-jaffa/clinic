import { withClinicRoute } from "@/features/auth/guard";
import { saveVitals } from "@/features/visits/records";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { saveVitalsSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A visit's vitals (plan §12.2, D202), for whoever reads visits. Which
 * permission writes them hangs on the visit, so the database asks it:
 * `visits.create` while it is open, `visits.edit` once it is done (D208).
 */
export async function PUT(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.view" }, async (context) =>
    saveVitals(context, { visitId: (await params).id }, await readJson(request, saveVitalsSchema), context.requestId),
  );
}
