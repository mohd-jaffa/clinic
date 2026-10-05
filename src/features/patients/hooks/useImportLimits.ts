"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { ImportLimits } from "../types";

/** How many rows a patient import may hold (D128), and how many each request sends. */
export function useImportLimits() {
  return useApiQuery<ImportLimits>(apiRoutes.patients.import);
}
