"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { ConsoleOverview } from "../types";

/** The console's Overview (plan §20.1), read again when the DEV comes back to it. */
export function useConsoleOverview() {
  return useApiQuery<ConsoleOverview>(apiRoutes.console.overview, { revalidateOnFocus: true });
}
