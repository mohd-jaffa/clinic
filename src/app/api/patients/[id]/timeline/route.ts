import { withClinicRoute } from "@/features/auth/guard";
import { listPatientTimeline } from "@/features/patients/timeline";
import { readQuery } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { pageQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A page of a patient's history (plan §10.3), for `patients.view`: each part only with its own permission. */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "patients.view" }, async (tenant) => {
    const { cursor } = readQuery(request, pageQuerySchema);
    return listPatientTimeline(tenant, (await params).id, cursor);
  });
}
