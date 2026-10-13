import { withClinicRoute } from "@/features/auth/guard";
import { startVisit } from "@/features/visits/records";
import { readJson } from "@/lib/api/handler";
import { startVisitSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** New visit from a patient's profile (D204), for `visits.create` — or the one already open with that doctor. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "visits.create" }, async (context) =>
    startVisit(context, await readJson(request, startVisitSchema), context.requestId),
  );
}
