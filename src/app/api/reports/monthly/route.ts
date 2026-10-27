import { withClinicRoute } from "@/features/auth/guard";
import { getMonthlyReport } from "@/features/reports/api";
import { readQuery } from "@/lib/api/handler";
import { monthlyReportQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A month's report (plan §18; D53), for `reports.view`. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "reports.view" }, (tenant) =>
    getMonthlyReport(tenant, readQuery(request, monthlyReportQuerySchema)),
  );
}
