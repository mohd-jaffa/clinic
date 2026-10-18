import { withClinicRoute } from "@/features/auth/guard";
import { issueBill } from "@/features/billing/api";
import { readJson } from "@/lib/api/handler";
import { readIdempotencyKey } from "@/lib/api/idempotency";
import { billSchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Issue a bill (plan §15.2), for `payments.create` — with what is collected
 * with it (D282) — once per Idempotency-Key, however often it is sent.
 */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "payments.create", successStatus: 201 }, async (context) =>
    issueBill(context, await readJson(request, billSchema), readIdempotencyKey(request), context.requestId),
  );
}
