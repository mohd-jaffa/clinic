import { withClinicRoute } from "@/features/auth/guard";
import { removeClosure } from "@/features/clinic/closures";
import type { RouteParams } from "@/lib/api/params";

export const runtime = "nodejs";

/** Removes a holiday or leave not yet over (D84), for `settings.manage`. */
export async function DELETE(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "settings.manage" }, async (context) =>
    removeClosure(context, (await params).id, context.requestId),
  );
}
