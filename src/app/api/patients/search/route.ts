import { withClinicRoute } from "@/features/auth/guard";
import { listPatients } from "@/features/patients/api";
import { readJson } from "@/lib/api/handler";
import { patientListSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A page of the patients list (plan §10.2), for `patients.view`: what is
 * searched for in the body, never the address (D98) — a read, so a view-only
 * clinic still asks it. The archived tab is for `patients.edit`.
 */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "patients.view", allowReadOnly: true }, async (tenant) =>
    listPatients(tenant, await readJson(request, patientListSchema)),
  );
}
