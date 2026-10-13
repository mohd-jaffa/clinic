import { markUrgent } from "@/features/appointments/moves";
import { withClinicRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import { urgentSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Urgent, or not (D201), for `appointments.edit`: a tag on a waiting patient that stays through their visit. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "appointments.edit" }, async (context) =>
    markUrgent(context, await readJson(request, urgentSchema), context.requestId),
  );
}
