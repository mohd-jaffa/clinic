"use client";

import type { ActivityKind } from "@/constants/statuses";
import { useApiPages } from "@/lib/query/useApiPages";

import { activityKey } from "../keys";
import type { ActivityEntry } from "../types";

/**
 * A page at a time of the clinic's activity (plan §19; D388, D390), the
 * latest first, kept to a person and a kind. Each choice is its own list:
 * another never shows the last one's rows (D191).
 */
export function useActivity(person: string | null, kind: ActivityKind | null) {
  return useApiPages<ActivityEntry>(activityKey(person, kind), { list: `${person ?? "ALL"}:${kind ?? "ALL"}` });
}
