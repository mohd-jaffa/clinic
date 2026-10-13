import { markDone } from "@/features/appointments/moves";
import { withClinicRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import { queueMoveSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Done (plan §11.4, D43), for `appointments.edit`: the patient in is done, and their visit closes. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "appointments.edit" }, async (context) =>
    markDone(context, await readJson(request, queueMoveSchema), context.requestId),
  );
}
