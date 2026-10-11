"use client";

import type { PatientAppointment } from "@/features/appointments/types";
import { apiRoutes } from "@/lib/query/keys";
import { useApiPages } from "@/lib/query/useApiPages";

/** A patient's history, a page at a time (plan §10.3, D167): each part only for those who may see it. */
export function usePatientTimeline(id: string) {
  return useApiPages<PatientAppointment>(apiRoutes.patients.timeline(id));
}
