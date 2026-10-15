import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { changeTemplate } from "@/features/prescriptions/templates";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { changeTemplateSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * One of the caller's templates: its name, medicines and advice, or archiving
 * or restoring it (D242). The database keeps it to the doctor whose it is
 * (D240).
 */
export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.member }, async (context) =>
    changeTemplate(context, (await params).id, await readJson(request, changeTemplateSchema), context.requestId),
  );
}
