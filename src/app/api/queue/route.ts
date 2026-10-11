import { listQueue } from "@/features/appointments/api";
import { withClinicRoute } from "@/features/auth/guard";
import { readQuery } from "@/lib/api/handler";
import { queueQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Today's queue (plan §11.4), for `appointments.view`: one doctor's, or every doctor's. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "appointments.view" }, (tenant) =>
    listQueue(tenant, readQuery(request, queueQuerySchema)),
  );
}
