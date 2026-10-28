"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiPages } from "@/lib/query/useApiPages";

import type { ConsoleAuditEntry } from "../types";

/** A page at a time of the platform audit (plan §20.7), the latest first. */
export function useConsoleAudit() {
  return useApiPages<ConsoleAuditEntry>(apiRoutes.console.audit);
}
