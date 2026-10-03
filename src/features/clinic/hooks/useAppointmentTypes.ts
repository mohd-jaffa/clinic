"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { AppointmentType } from "../types";

/** The clinic's appointment types (plan §9, D32), in its order, archived ones too. */
export function useAppointmentTypes() {
  return useApiQuery<AppointmentType[]>(apiRoutes.appointmentTypes.list);
}
