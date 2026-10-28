"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { PlanView } from "../types";

/** The owner's plan (plan §7.5): where it stands, the prices, how to renew, and its history. */
export function usePlan() {
  return useApiQuery<PlanView>(apiRoutes.subscription.plan);
}
