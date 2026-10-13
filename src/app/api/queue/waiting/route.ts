import { backToWaiting } from "@/features/appointments/moves";
import { withClinicRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import { queueMoveSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Back to waiting (D197), for `appointments.edit`: the patient in waits again with their token. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "appointments.edit" }, async (context) =>
    backToWaiting(context, await readJson(request, queueMoveSchema), context.requestId),
  );
}
