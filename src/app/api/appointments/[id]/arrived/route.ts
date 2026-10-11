import { markArrived } from "@/features/appointments/api";
import { withClinicRoute } from "@/features/auth/guard";
import type { RouteParams } from "@/lib/api/params";

export const runtime = "nodejs";

/** A booked patient at the desk (plan §11.3, D143), for `appointments.edit`: their token, on the day itself. */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "appointments.edit" }, async (context) =>
    markArrived(context, (await params).id, context.requestId),
  );
}
