"use client";

import { useApiQuery } from "@/lib/query/useApiQuery";

import { dailyReportKey } from "../keys";
import type { DailyReport } from "../types";

/** A day's report (plan §18; D356); the last day's kept on screen while the next one loads. */
export function useDailyReport(day: string) {
  return useApiQuery<DailyReport>(dailyReportKey(day), { keepPreviousData: true });
}
