"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiPages } from "@/lib/query/useApiPages";

import type { OutstandingPatient } from "../types";

/** A page at a time of who owes, most first (plan §15.4; D321). */
export function useOutstanding() {
  return useApiPages<OutstandingPatient>(apiRoutes.outstanding.list);
}
