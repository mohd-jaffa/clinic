import { withClinicRoute } from "@/features/auth/guard";
import { restorePatient } from "@/features/patients/api";
import type { RouteParams } from "@/lib/api/params";

export const runtime = "nodejs";

/** Restores an archived patient (plan §10.1, D103), for `patients.edit` — a doctor's own only (D3). */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "patients.edit" }, async (context) =>
    restorePatient(context, (await params).id, context.requestId),
  );
}
