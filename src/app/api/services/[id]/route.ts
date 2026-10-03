import { withClinicRoute } from "@/features/auth/guard";
import { services } from "@/features/clinic/catalogues";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { changeServiceSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A service's details, or archiving or restoring it (D80), for `settings.manage`. */
export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "settings.manage" }, async (context) =>
    services.change(context, (await params).id, await readJson(request, changeServiceSchema), context.requestId),
  );
}
