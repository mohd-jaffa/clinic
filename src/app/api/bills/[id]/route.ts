import { withClinicRoute } from "@/features/auth/guard";
import { getBill } from "@/features/billing/api";
import type { RouteParams } from "@/lib/api/params";

export const runtime = "nodejs";

/** A bill for its page (plan §15.2; D314), for `payments.view` — a doctor's own patients' only (D3). */
export async function GET(request: Request, { params }: RouteParams<"id">) {
  return withClinicRoute(request, { access: "payments.view" }, async (tenant) => getBill(tenant, (await params).id));
}
