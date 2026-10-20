import { withClinicRoute } from "@/features/auth/guard";
import { issueBill, listBills } from "@/features/billing/api";
import { readJson, readQuery } from "@/lib/api/handler";
import { readIdempotencyKey } from "@/lib/api/idempotency";
import { billSchema, billsQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A page of the bills issued on the days asked, each with where it stands (plan §15.4; D320), for `payments.view`. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "payments.view" }, (tenant) =>
    listBills(tenant, readQuery(request, billsQuerySchema)),
  );
}

/**
 * Issue a bill (plan §15.2), for `payments.create` — with what is collected
 * with it (D282) — once per Idempotency-Key, however often it is sent.
 */
export async function POST(request: Request) {
  return withClinicRoute(request, { access: "payments.create", successStatus: 201 }, async (context) =>
    issueBill(context, await readJson(request, billSchema), readIdempotencyKey(request), context.requestId),
  );
}
