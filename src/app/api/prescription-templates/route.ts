import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { addTemplate, listTemplates } from "@/features/prescriptions/templates";
import { readJson, readQuery } from "@/lib/api/handler";
import { saveTemplateSchema, templatesQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A doctor's prescription templates, archived ones too (plan §13; D241,
 * D242). For any member: the database answers with the doctor's own, or any
 * doctor's for whoever types for them (`prescriptions.write`) — and none for
 * anyone else.
 */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.member }, async (tenant) =>
    listTemplates(tenant, readQuery(request, templatesQuerySchema).doctorId),
  );
}

/** A new template of the caller's own (D240, D243): the database refuses anyone who is not a doctor. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.member }, async (context) =>
    addTemplate(context, await readJson(request, saveTemplateSchema), context.requestId),
  );
}
