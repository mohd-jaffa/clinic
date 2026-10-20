import { withClinicRoute } from "@/features/auth/guard";
import { listOutstanding } from "@/features/billing/payments";
import { readQuery } from "@/lib/api/handler";
import { pageQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A page of the patients who owe, most first (plan §15.4; D321), for `payments.view`. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "payments.view" }, (tenant) =>
    listOutstanding(tenant, readQuery(request, pageQuerySchema)),
  );
}
