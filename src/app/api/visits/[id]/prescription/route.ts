import { withClinicRoute } from "@/features/auth/guard";
import { savePrescription } from "@/features/prescriptions/records";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { savePrescriptionSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A visit's prescription, whole (plan §13, D210), for whoever reads visits.
 * Who may write it hangs on the visit, so the database asks it: the visit's
 * doctor, or `prescriptions.write` to type it for them (D45), open or done
 * (D215). The visit's own read carries it (`GET /api/visits/[id]`).
 */
export async function PUT(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.view" }, async (context) =>
    savePrescription(context, (await params).id, await readJson(request, savePrescriptionSchema), context.requestId),
  );
}
