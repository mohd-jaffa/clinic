import { withClinicRoute } from "@/features/auth/guard";
import { voidPayment } from "@/features/billing/payments";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { voidPaymentSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Void a payment or a refund, with a reason (plan §15.3; D336), for `payments.edit`; again, it changes nothing. */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "payments.edit" }, async (context) =>
    voidPayment(context, (await params).id, await readJson(request, voidPaymentSchema), context.requestId),
  );
}
