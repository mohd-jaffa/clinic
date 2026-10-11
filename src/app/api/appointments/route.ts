import { withClinicRoute } from "@/features/auth/guard";
import { bookAppointment, listAppointments } from "@/features/appointments/api";
import { readJson, readQuery } from "@/lib/api/handler";
import { readIdempotencyKey } from "@/lib/api/idempotency";
import { bookingSchema, calendarQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** The calendar's appointments (plan §11.5), for `appointments.view`: a day or a week, one doctor's or all. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "appointments.view" }, (tenant) =>
    listAppointments(tenant, readQuery(request, calendarQuerySchema)),
  );
}

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
