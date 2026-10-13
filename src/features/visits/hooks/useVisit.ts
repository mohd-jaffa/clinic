"use client";

import { QUEUE_REFRESH_MS } from "@/constants/limits";
import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { Visit } from "../types";

/**
 * A visit's header (plan §12.2, D195). The queue moves under it — another
 * desk marks the patient done — so it is read again as the queue is, every
 * QUEUE_REFRESH_MS and on focus, never while the tab is hidden.
 */
export function useVisit(id: string) {
  return useApiQuery<Visit>(apiRoutes.visits.one(id), {
    refreshInterval: QUEUE_REFRESH_MS,
    revalidateOnFocus: true,
  });
}
