"use client";

import { useApiPages } from "@/lib/query/useApiPages";
import type { PatientTab } from "@/lib/validation";

import { patientsKey } from "../keys";
import type { PatientListItem } from "../types";

/** A page at a time of the patients list (plan §10.2), searched in the body of each ask (D98). */
export function usePatients(search: string, tab: PatientTab) {
  return useApiPages<PatientListItem>(patientsKey(search, tab), { post: true });
}
