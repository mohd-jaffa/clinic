import { withClinicRoute } from "@/features/auth/guard";
import { finishVisit } from "@/features/visits/records";
import type { RouteParams } from "@/lib/api/params";

export const runtime = "nodejs";

/** Done for a visit started from a profile (D204), for `visits.create`: it closes as To bill. */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "visits.create" }, async (context) =>
    finishVisit(context, (await params).id, context.requestId),
  );
}
