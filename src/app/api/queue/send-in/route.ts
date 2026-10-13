import { sendIn } from "@/features/appointments/moves";
import { withClinicRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import { sendInSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Send in (plan §11.4, D192), for `appointments.edit`: a waiting patient goes in, and their visit opens. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "appointments.edit" }, async (context) =>
    sendIn(context, await readJson(request, sendInSchema), context.requestId),
  );
}
