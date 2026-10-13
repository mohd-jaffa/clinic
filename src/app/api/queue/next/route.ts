import { nextPatient } from "@/features/appointments/moves";
import { withClinicRoute } from "@/features/auth/guard";
import { readJson } from "@/lib/api/handler";
import { nextPatientSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Next patient (D193, D196), for `appointments.edit`: the patient in is done, and the lowest waiting token goes in. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "appointments.edit" }, async (context) =>
    nextPatient(context, await readJson(request, nextPatientSchema), context.requestId),
  );
}
