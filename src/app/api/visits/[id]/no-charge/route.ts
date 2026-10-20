import { withClinicRoute } from "@/features/auth/guard";
import { markNoCharge } from "@/features/billing/checkout";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { noChargeSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Settle a visit waiting in To bill free, with a reason (plan §15.6; D319), for `payments.create`. */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "payments.create" }, async (context) =>
    markNoCharge(context, (await params).id, await readJson(request, noChargeSchema), context.requestId),
  );
}
