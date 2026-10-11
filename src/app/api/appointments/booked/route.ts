import { withClinicRoute } from "@/features/auth/guard";
import { listBookedTimes } from "@/features/appointments/api";
import { readQuery } from "@/lib/api/handler";
import { bookedTimesSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A doctor's taken times on a day (D147), for whoever books: times only, never patients. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "appointments.create" }, (tenant) =>
    listBookedTimes(tenant, readQuery(request, bookedTimesSchema)),
  );
}
