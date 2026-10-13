import { markSteppedOut } from "@/features/appointments/moves";
import { withClinicRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import { steppedOutSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Stepped out, or back (D198), for `appointments.edit`: a waiting patient keeps their place, and Next patient skips them. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "appointments.edit" }, async (context) =>
    markSteppedOut(context, await readJson(request, steppedOutSchema), context.requestId),
  );
}
