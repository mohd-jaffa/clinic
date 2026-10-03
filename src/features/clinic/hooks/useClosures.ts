"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { Closure } from "../types";

/** Holidays and leave (plan §9), past ones too, by their first day. */
export function useClosures() {
  return useApiQuery<Closure[]>(apiRoutes.closures.list);
}
