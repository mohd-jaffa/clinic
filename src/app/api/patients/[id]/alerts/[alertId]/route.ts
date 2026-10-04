import { withClinicRoute } from "@/features/auth/guard";
import { updateAlert } from "@/features/patients/alerts";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { updateAlertSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** An alert's name or note, or turning it off (D118, D119), for `visits.edit`. */
export async function PATCH(request: Request, { params }: RouteParams<"id" | "alertId">) {
  return withClinicRoute(request, { access: "visits.edit" }, async (context) => {
    const { id, alertId } = await params;
    return updateAlert(context, id, alertId, await readJson(request, updateAlertSchema), context.requestId);
  });
}
