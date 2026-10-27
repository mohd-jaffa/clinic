import { withClinicRoute } from "@/features/auth/guard";
import { getDailyReport } from "@/features/reports/api";
import { readQuery } from "@/lib/api/handler";
import { dailyReportQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/** A day's report (plan §18; D49), for `reports.view`. */
export async function GET(request: Request) {
  return withClinicRoute(request, { access: "reports.view" }, (tenant) =>
    getDailyReport(tenant, readQuery(request, dailyReportQuerySchema)),
  );
}
