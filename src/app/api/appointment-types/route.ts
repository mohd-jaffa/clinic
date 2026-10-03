import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { appointmentTypes } from "@/features/clinic/catalogues";
import { readJson } from "@/lib/api/handler";
import { appointmentTypeSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Appointment types (plan §9, D32, D81), archived ones too, for any member: the pickers read them. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.member }, (tenant) => appointmentTypes.list(tenant));
}

/** A new appointment type, for `settings.manage`; it joins the end of the list (D81). */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "settings.manage", successStatus: 201 }, async (context) =>
    appointmentTypes.add(context, await readJson(request, appointmentTypeSchema), context.requestId),
  );
}
