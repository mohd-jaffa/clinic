import { withClinicRoute } from "@/features/auth/guard";
import { listClosureAppointments } from "@/features/clinic/closures";
import { readQuery } from "@/lib/api/handler";
import { closureDaysSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * The appointments on the days of a holiday or leave being added (D137), for
 * `settings.manage`, which adding one needs. Days and a doctor, never a
 * patient, so they travel in the address.
 */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "settings.manage" }, (tenant) =>
    listClosureAppointments(tenant, readQuery(request, closureDaysSchema)),
  );
}
