import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { getImportLimits, importPatients } from "@/features/patients/import";
import { readJson } from "@/lib/api/handler";
import { importBatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** How many rows an import may hold (D128), and each request sends — the owner's. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.owner }, async () => getImportLimits());
}

/**
 * One batch of a patient import (plan §10.5, D51), the owner's: the rows
 * checked again as the preview checked them; each row's key makes a batch
 * sent twice add no one twice.
 */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.owner }, async (context) =>
    importPatients(context, (await readJson(request, importBatchSchema)).rows, context.requestId),
  );
}
