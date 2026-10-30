"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { ConsoleSettings } from "../types";

/** The platform settings in the console (plan §20.4), and who last changed them. */
export function useConsoleSettings() {
  return useApiQuery<ConsoleSettings>(apiRoutes.console.settings);
}
