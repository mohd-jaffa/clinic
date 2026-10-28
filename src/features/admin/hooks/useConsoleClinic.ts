"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { ConsoleClinicDetail } from "../types";

/** One clinic's page in the console (plan §20.3). */
export function useConsoleClinic(clinicId: string) {
  return useApiQuery<ConsoleClinicDetail>(apiRoutes.console.clinic(clinicId));
}
