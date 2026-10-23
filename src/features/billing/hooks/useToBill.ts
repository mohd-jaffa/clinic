"use client";

import { QUEUE_REFRESH_MS } from "@/constants/limits";
import { useApiPages } from "@/lib/query/useApiPages";

import { toBillKey } from "../keys";
import type { ToBillVisit } from "../types";

/**
 * A page at a time of the visits waiting in To bill (plan §15.6; D318): one
 * doctor's, or every doctor's. On the queue (`beside`) it is read again as
 * often as the queue, and only for whoever reads bills (`enabled`).
 */
export function useToBill(doctorId?: string, { enabled = true, beside = false } = {}) {
  return useApiPages<ToBillVisit>(enabled ? toBillKey(doctorId) : null, {
    list: doctorId ?? "",
    ...(beside && { refreshInterval: QUEUE_REFRESH_MS }),
  });
}
