"use client";

import { toE164India } from "@/lib/phone";
import { apiRoutes } from "@/lib/query/keys";
import { useApiLookup } from "@/lib/query/useApiLookup";

import type { PatientMatch } from "../types";

/**
 * "Already here?" (plan §10.1, D106): the patients with the mobile being
 * typed, asked once it is a whole number — never for a part of one.
 */
export function usePatientMatches(typed: string) {
  const phone = toE164India(typed);
  return useApiLookup<PatientMatch[]>(apiRoutes.patients.matches, phone === null ? null : { phone });
}
