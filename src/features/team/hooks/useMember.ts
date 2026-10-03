"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { MemberDetail } from "../types";

/** One member, with their mobile and a doctor's details (plan §8.6). */
export function useMember(id: string) {
  return useApiQuery<MemberDetail>(apiRoutes.team.member(id));
}
