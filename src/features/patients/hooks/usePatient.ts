"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { Patient } from "../types";

/** One patient, with their doctor's name (plan §10.3) — a doctor's own only (D3). */
export function usePatient(id: string) {
  return useApiQuery<Patient>(apiRoutes.patients.one(id));
}
