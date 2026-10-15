import { withClinicRoute } from "@/features/auth/guard";
import { changeTreatmentStatus } from "@/features/treatments/records";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { treatmentStatusSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Started, held, resumed, completed or cancelled — with a reason or none (plan §14.1; D250, D251), for `visits.edit`. */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.edit" }, async (context) =>
    changeTreatmentStatus(
      context,
      (await params).id,
      await readJson(request, treatmentStatusSchema),
      context.requestId,
    ),
  );
}
