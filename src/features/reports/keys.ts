import { apiRoutes, withQuery } from "@/lib/query/keys";

/** A day's report (D356). */
export const dailyReportKey = (day: string) => withQuery(apiRoutes.reports.daily, { day });

/** A month's report, by its first day. */
export const monthlyReportKey = (month: string) => withQuery(apiRoutes.reports.monthly, { month });
