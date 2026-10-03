import { withClinicRoute } from "@/features/auth/guard";
import { createPatient } from "@/features/patients/api";
import { readJson } from "@/lib/api/handler";
import { readIdempotencyKey } from "@/lib/api/idempotency";
import { patientSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A new patient (plan §10.1), for `patients.create`: once per Idempotency-Key, however often it is sent. */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "patients.create", successStatus: 201 }, async (context) =>
    createPatient(context, await readJson(request, patientSchema), readIdempotencyKey(request), context.requestId),
  );
}
