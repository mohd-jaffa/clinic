"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { TeamMember } from "../types";

/** The team (plan §8.6): everyone of the clinic, invited and inactive too. */
export function useTeam() {
  return useApiQuery<TeamMember[]>(apiRoutes.team.list);
}
