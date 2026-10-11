"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { PatientSummary } from "../types";

/** Where a patient stands (plan §10.3): each part only for those who may see it. */
export function usePatientSummary(id: string) {
  return useApiQuery<PatientSummary>(apiRoutes.patients.summary(id));
}
