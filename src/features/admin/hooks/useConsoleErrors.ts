"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiPages } from "@/lib/query/useApiPages";

import type { ConsoleError } from "../types";

/** A page at a time of the error log (plan §20.6), the latest first. */
export function useConsoleErrors() {
  return useApiPages<ConsoleError>(apiRoutes.console.logs);
}
