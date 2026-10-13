import { withClinicRoute } from "@/features/auth/guard";
import { saveVitals } from "@/features/visits/records";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { saveVitalsSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** The vitals of a patient still waiting (D203), for `visits.create`: their visit opens with the first reading. */
export async function PUT(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.create" }, async (context) =>
    saveVitals(
      context,
      { appointmentId: (await params).id },
      await readJson(request, saveVitalsSchema),
      context.requestId,
    ),
  );
}
