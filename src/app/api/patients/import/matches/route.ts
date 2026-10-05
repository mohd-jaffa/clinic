import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { findImportMatches } from "@/features/patients/import";
import { readJson } from "@/lib/api/handler";
import { importMatchesSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * The clinic's patients on an import's mobiles (plan §10.5), for its possible
 * duplicates — the owner's; asked in the body, never the address (D98).
 */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.owner, allowReadOnly: true }, async (tenant) =>
    findImportMatches(tenant, (await readJson(request, importMatchesSchema)).phones),
  );
}
