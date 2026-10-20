import { withClinicRoute } from "@/features/auth/guard";
import { countToBill } from "@/features/billing/checkout";
import { readQuery } from "@/lib/api/handler";
import { toBillCountQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** How many visits wait in To bill (D337), for `payments.view`: one doctor's, or every doctor's. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "payments.view" }, (tenant) =>
    countToBill(tenant, readQuery(request, toBillCountQuerySchema)),
  );
}
