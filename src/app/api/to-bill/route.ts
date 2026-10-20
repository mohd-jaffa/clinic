import { withClinicRoute } from "@/features/auth/guard";
import { listToBill } from "@/features/billing/checkout";
import { readQuery } from "@/lib/api/handler";
import { toBillQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A page of the visits waiting in To bill (plan §15.6; D318), for `payments.view`: one doctor's, or every doctor's. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "payments.view" }, (tenant) =>
    listToBill(tenant, readQuery(request, toBillQuerySchema)),
  );
}
