"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { PatientAlert } from "../types";

/** A patient's alerts (plan §10.4), turned off ones too — asked only by someone who may read them. */
export function useAlerts(patientId: string, mayRead: boolean) {
  return useApiQuery<PatientAlert[]>(mayRead ? apiRoutes.patients.alerts(patientId) : null);
}
