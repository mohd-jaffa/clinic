"use client";

import { useApiQuery } from "@/lib/query/useApiQuery";

import { monthlyReportKey } from "../keys";
import type { MonthlyReport } from "../types";

/** A month's report (plan §18), by its first day; the last month's kept on screen while the next one loads. */
export function useMonthlyReport(month: string) {
  return useApiQuery<MonthlyReport>(monthlyReportKey(month), { keepPreviousData: true });
}
