import { withClinicRoute } from "@/features/auth/guard";
import { medicineSuggestions } from "@/features/prescriptions/api";
import { readQuery } from "@/lib/api/handler";
import { medicineSearchSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * This clinic's medicines beginning with `q`, each as last written — by
 * `doctorId` first (plan §13, D211). For whoever reads visits; the database
 * keeps them to a doctor, or whoever types for one.
 */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "visits.view" }, async (tenant) =>
    medicineSuggestions(tenant, readQuery(request, medicineSearchSchema)),
  );
}
