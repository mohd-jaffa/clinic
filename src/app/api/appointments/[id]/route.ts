import { changeAppointment, getAppointment } from "@/features/appointments/api";
import { withClinicRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { appointmentChangeSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** An appointment's detail (plan §11.2, D160), for `appointments.view` — a doctor's own patients' only (D3). */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "appointments.view" }, async (tenant) =>
    getAppointment(tenant, (await params).id),
  );
}

/** Its notes, or the appointment moved (plan §11.1, D161), for `appointments.edit`. */
export async function PATCH(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "appointments.edit" }, async (context) =>
    changeAppointment(context, (await params).id, await readJson(request, appointmentChangeSchema), context.requestId),
  );
}
