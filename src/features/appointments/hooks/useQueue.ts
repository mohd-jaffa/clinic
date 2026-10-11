"use client";

import { QUEUE_REFRESH_MS } from "@/constants/limits";
import { useApiQuery } from "@/lib/query/useApiQuery";

import { queueKey } from "../keys";
import type { QueueAppointment } from "../types";

/**
 * Today's queue (plan §11.4; D34): one doctor's, or every doctor's (""),
 * read again every QUEUE_REFRESH_MS and on focus — never while the tab is
 * hidden.
 */
export function useQueue(doctorId: string) {
  return useApiQuery<QueueAppointment[]>(queueKey(doctorId), {
    refreshInterval: QUEUE_REFRESH_MS,
    revalidateOnFocus: true,
  });
}
