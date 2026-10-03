"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { ClinicProfile } from "../types";

/** The clinic's profile (plan §9), as Clinic details shows it. */
export function useClinic() {
  return useApiQuery<ClinicProfile>(apiRoutes.clinic.profile);
}
