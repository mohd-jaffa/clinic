import { withClinicRoute } from "@/features/auth/guard";
import { createTreatment } from "@/features/treatments/records";
import { readJson } from "@/lib/api/handler";
import { newTreatmentSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A new treatment (plan §14.1; D252, D258), for `visits.edit`: in a visit,
 * its doctor's — begun today, that visit its first session — or from the
 * profile, for the doctor chosen. Read back with the visit or the profile.
 */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "visits.edit", successStatus: 201 }, async (context) =>
    createTreatment(context, await readJson(request, newTreatmentSchema), context.requestId),
  );
}
