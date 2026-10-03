import { withClinicRoute } from "@/features/auth/guard";
import { appointmentTypes } from "@/features/clinic/catalogues";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { changeAppointmentTypeSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** An appointment type's details, or archiving or restoring it (D80), for `settings.manage`. */
export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "settings.manage" }, async (context) =>
    appointmentTypes.change(
      context,
      (await params).id,
      await readJson(request, changeAppointmentTypeSchema),
      context.requestId,
    ),
  );
}
