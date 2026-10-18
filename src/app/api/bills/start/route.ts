import { withClinicRoute } from "@/features/auth/guard";
import { getBillStart } from "@/features/billing/api";
import { readQuery } from "@/lib/api/handler";
import { billStartQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Where a new bill starts (plan §15.2, D313): a visit, an arrival or a patient, by id — for `payments.create`. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "payments.create" }, (tenant) =>
    getBillStart(tenant, readQuery(request, billStartQuerySchema)),
  );
}
