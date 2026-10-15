"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { FollowUpCounts } from "../types";

/** How many each of the follow-ups' tabs holds (plan §14.3), beside its name; snoozed ones left out (D271). */
export function useFollowUpCounts() {
  return useApiQuery<FollowUpCounts>(apiRoutes.followUps.counts);
}
