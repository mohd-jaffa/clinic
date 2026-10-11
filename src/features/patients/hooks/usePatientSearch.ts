"use client";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Page } from "@/lib/api/pagination";
import { apiRoutes } from "@/lib/query/keys";
import { useApiLookup } from "@/lib/query/useApiLookup";

import type { PatientListItem } from "../types";

/**
 * A patient found by what is typed — a name, a mobile, a number — for a
 * picker (D144): the first page of the patients list's search, best match
 * first, asked in the body once the typing settles (D98). Archived patients
 * are not found: nothing is booked for them (D103).
 */
export function usePatientSearch(typed: string) {
  const search = useDebouncedValue(typed.trim());
  return useApiLookup<Page<PatientListItem>>(apiRoutes.patients.search, search ? { search, tab: "ALL" } : null);
}
