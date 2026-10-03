import { ROUTE_ACCESS } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { updateOwnDoctor } from "@/features/team/members";
import { readJson } from "@/lib/api/handler";
import { ownDoctorSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** The owner's own doctor profile (plan §3.1, D96, D97): whether they see patients, and their details. */
export async function PATCH(request: Request) {
  return withClinicRoute(request, { access: ROUTE_ACCESS.owner }, async (context) =>
    updateOwnDoctor(context, await readJson(request, ownDoctorSchema), context.requestId),
  );
}
