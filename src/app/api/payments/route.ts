import { withClinicRoute } from "@/features/auth/guard";
import { listPayments, recordPayment } from "@/features/billing/payments";
import { readJson, readQuery } from "@/lib/api/handler";
import { readIdempotencyKey } from "@/lib/api/idempotency";
import { paymentSchema, paymentsQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A page of the payments and refunds paid on the days asked (plan §15.4; D320), for `payments.view`. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "payments.view" }, (tenant) =>
    listPayments(tenant, readQuery(request, paymentsQuerySchema)),
  );
}

/**
 * Record a payment (plan §15.3), for `payments.create` — or a refund, for
 * `payments.edit` too (D322) — once per Idempotency-Key, however often it is
 * sent.
 */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "payments.create", successStatus: 201 }, async (context) =>
    recordPayment(context, await readJson(request, paymentSchema), readIdempotencyKey(request), context.requestId),
  );
}
