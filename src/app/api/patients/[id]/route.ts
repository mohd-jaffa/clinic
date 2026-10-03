import { withClinicRoute } from "@/features/auth/guard";
import { getPatient, updatePatient } from "@/features/patients/api";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { updatePatientSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A patient (plan §10.3), for `patients.view` — a doctor's own only (D3). */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "patients.view" }, async (tenant) => getPatient(tenant, (await params).id));
}

/** The fields sent (plan §10.1), for `patients.edit`; refused while the patient is archived (D103). */
export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "patients.edit" }, async (context) =>
    updatePatient(context, (await params).id, await readJson(request, updatePatientSchema), context.requestId),
  );
}
