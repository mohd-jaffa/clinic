import { withClinicRoute } from "@/features/auth/guard";
import { findPatientMatches } from "@/features/patients/api";
import { readJson } from "@/lib/api/handler";
import { patientMatchesSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * "Already here?" (plan §10.1, D106): the patients with a mobile, asked in
 * the body so the number never lands in an address (D98) — a read, so a
 * view-only clinic still asks it.
 */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "patients.view", allowReadOnly: true }, async (tenant) =>
    findPatientMatches(tenant, (await readJson(request, patientMatchesSchema)).phone),
  );
}
