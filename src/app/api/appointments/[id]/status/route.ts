import { changeAppointmentStatus } from "@/features/appointments/api";
import { withClinicRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { statusChangeSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Confirmed, back to scheduled, a no-show or cancelled (plan §11.2). The route
 * lets in those who reach patients; the status sent then asks for its own
 * permission — `appointments.cancel` to cancel, `appointments.edit` for the
 * rest — and the database asks again.
 */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "patients.view" }, async (context) =>
    changeAppointmentStatus(context, (await params).id, await readJson(request, statusChangeSchema), context.requestId),
  );
}
