"use client";

import { useApiPages } from "@/lib/query/useApiPages";

import { toBillKey } from "../keys";
import type { ToBillVisit } from "../types";

/** A page at a time of the visits waiting in To bill (plan §15.6; D318): one doctor's, or every doctor's. */
export function useToBill(doctorId?: string) {
  return useApiPages<ToBillVisit>(toBillKey(doctorId), { list: doctorId ?? "" });
}
