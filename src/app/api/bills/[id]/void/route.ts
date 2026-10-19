import { withClinicRoute } from "@/features/auth/guard";
import { voidBill } from "@/features/billing/api";
import { readJson } from "@/lib/api/handler";
import type { RouteParams } from "@/lib/api/params";
import { voidBillSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Void a bill, with a reason (plan §15.2; D314), for `payments.edit`; voided again, it changes nothing. */
export async function POST(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "payments.edit" }, async (context) =>
    voidBill(context, (await params).id, await readJson(request, voidBillSchema), context.requestId),
  );
}
