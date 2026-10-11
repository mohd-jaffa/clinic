import { addWalkIn } from "@/features/appointments/api";
import { withClinicRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import { readIdempotencyKey } from "@/lib/api/idempotency";
import { walkInSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A walk-in (plan §11.3, D171), for `appointments.create` — a new patient with
 * it needs `patients.create` too — once per Idempotency-Key, however often it
 * is sent. What is typed about a patient travels in the body (D98).
 */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "appointments.create", successStatus: 201 }, async (context) =>
    addWalkIn(context, await readJson(request, walkInSchema), readIdempotencyKey(request), context.requestId),
  );
}
