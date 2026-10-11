import { withClinicRoute } from "@/features/auth/guard";
import { getPatientSummary } from "@/features/patients/summary";
import type { RouteParams } from "@/lib/api/params";

export const runtime = "nodejs";

/** Where a patient stands (plan §10.3), for `patients.view`: each part only with its own permission. */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "patients.view" }, async (tenant) =>
    getPatientSummary(tenant, (await params).id),
  );
}
