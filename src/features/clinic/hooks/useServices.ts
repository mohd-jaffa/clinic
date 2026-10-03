"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { Service } from "../types";

/** The price list (plan §9), archived entries too: the screen and, later, the bill read it. */
export function useServices() {
  return useApiQuery<Service[]>(apiRoutes.services.list);
}
