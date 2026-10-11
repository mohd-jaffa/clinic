import { withClinicRoute } from "@/features/auth/guard";
import { bookAppointment } from "@/features/appointments/api";
import { readJson } from "@/lib/api/handler";
import { readIdempotencyKey } from "@/lib/api/idempotency";
import { bookingSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A booking (plan §11.1), for `appointments.create` — a new patient with it
 * needs `patients.create` too — once per Idempotency-Key, however often it is
 * sent. What is typed about a patient travels in the body (D98).
 */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "appointments.create", successStatus: 201 }, async (context) =>
    bookAppointment(context, await readJson(request, bookingSchema), readIdempotencyKey(request), context.requestId),
  );
}
