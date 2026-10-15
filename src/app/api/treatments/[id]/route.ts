import { withClinicRoute } from "@/features/auth/guard";
import { updateTreatment } from "@/features/treatments/records";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { changeTreatmentSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Its details, or its next due day, from the copy the screen read (D251, D252, D259), for `visits.edit`. */
export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.edit" }, async (context) =>
    updateTreatment(context, (await params).id, await readJson(request, changeTreatmentSchema), context.requestId),
  );
}
