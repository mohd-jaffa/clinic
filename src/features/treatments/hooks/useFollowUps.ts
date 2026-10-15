"use client";

import type { FollowUpTab } from "@/constants/statuses";
import { useApiPages } from "@/lib/query/useApiPages";

import { followUpsKey } from "../keys";
import type { FollowUp } from "../types";

/**
 * A page at a time of one of the follow-ups' tabs (plan §14.3). Each tab is
 * its own list: another tab never shows its rows (D191).
 */
export function useFollowUps(tab: FollowUpTab) {
  return useApiPages<FollowUp>(followUpsKey(tab), { list: tab });
}
