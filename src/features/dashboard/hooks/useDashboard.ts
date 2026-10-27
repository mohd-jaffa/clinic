"use client";

import { QUEUE_REFRESH_MS } from "@/constants/limits";
import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { Dashboard } from "../types";

/**
 * Home's figures and sections (plan §17), read again every QUEUE_REFRESH_MS
 * and on focus, as the queue is (D34, D353) — never while the tab is hidden.
 */
export function useDashboard() {
  return useApiQuery<Dashboard>(apiRoutes.dashboard.home, {
    refreshInterval: QUEUE_REFRESH_MS,
    revalidateOnFocus: true,
  });
}
