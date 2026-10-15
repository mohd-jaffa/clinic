import { withClinicRoute } from "@/features/auth/guard";
import { recordSession, removeSession } from "@/features/treatments/records";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { treatmentSessionSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * What a visit did for a treatment (D248, D249, D256, D257), for
 * `visits.edit`: its session, recorded or its note changed from the copy
 * read — and the treatment completed with it, when it completes it.
 */
export async function PUT(request: Request, { params }: RouteParams<"id" | "visitId">) {
  return withClinicRoute(request, { access: "visits.edit" }, async (context) => {
    const { id, visitId } = await params;
    return recordSession(context, id, visitId, await readJson(request, treatmentSessionSchema), context.requestId);
  });
}

/** The session recorded by mistake, while its visit is open (D254), for `visits.edit`. */
export async function DELETE(request: Request, { params }: RouteParams<"id" | "visitId">) {
  return withClinicRoute(request, { access: "visits.edit" }, async (context) => {
    const { id, visitId } = await params;
    return removeSession(context, id, visitId, context.requestId);
  });
}
