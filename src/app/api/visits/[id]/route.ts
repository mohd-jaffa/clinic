import { withClinicRoute } from "@/features/auth/guard";
import { getVisit } from "@/features/visits/api";
import { updateVisit } from "@/features/visits/records";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { visitChangeSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A visit and what it records (plan §12.2; D195, D202), for `visits.view` — a doctor's own patients' only (D3). */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.view" }, async (tenant) => getVisit(tenant, (await params).id));
}

/** One of its sections — complaint, diagnosis and notes, or the follow-up (D202, D205) — for `visits.edit`. */
export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.edit" }, async (context) =>
    updateVisit(context, (await params).id, await readJson(request, visitChangeSchema), context.requestId),
  );
}
