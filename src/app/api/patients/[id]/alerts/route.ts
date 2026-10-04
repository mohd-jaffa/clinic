import { withClinicRoute } from "@/features/auth/guard";
import { addAlert, listAlerts } from "@/features/patients/alerts";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { alertSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A patient's alerts (plan §10.4), turned off ones too, for `visits.view` — a doctor's own patients only (D3). */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.view" }, async (tenant) => listAlerts(tenant, (await params).id));
}

/** A new alert (plan §10.4), for `visits.edit`; refused while the patient is archived (D103). */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.edit", successStatus: 201 }, async (context) =>
    addAlert(context, (await params).id, await readJson(request, alertSchema), context.requestId),
  );
}
