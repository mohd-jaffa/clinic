import { markReminded } from "@/features/appointments/api";
import { withClinicRoute } from "@/features/auth/guard";
import type { RouteParams } from "@/lib/api/params";

export const runtime = "nodejs";

/** A reminder sent on WhatsApp (plan §22.1; D180, D182), for `appointments.edit`: noted now. */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "appointments.edit" }, async (context) =>
    markReminded(context, (await params).id, context.requestId),
  );
}
