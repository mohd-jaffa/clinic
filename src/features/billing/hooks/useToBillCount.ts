"use client";

import { QUEUE_REFRESH_MS } from "@/constants/limits";
import { useApiQuery } from "@/lib/query/useApiQuery";

import { toBillCountKey } from "../keys";
import type { ToBillCount } from "../types";

/**
 * How many wait in To bill (D337) — one doctor's, or every doctor's — read
 * again as often as the queue, for whoever reads bills; nothing is asked
 * for anyone else.
 */
export function useToBillCount(enabled: boolean, doctorId?: string) {
  return useApiQuery<ToBillCount>(enabled ? toBillCountKey(doctorId) : null, { refreshInterval: QUEUE_REFRESH_MS });
}
