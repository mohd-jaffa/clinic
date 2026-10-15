"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiPages } from "@/lib/query/useApiPages";

import type { TimelineEntry } from "../types";

/** A patient's history, a page at a time (plan §10.3, D225): each part only for those who may see it. */
export function usePatientTimeline(id: string) {
  return useApiPages<TimelineEntry>(apiRoutes.patients.timeline(id));
}
