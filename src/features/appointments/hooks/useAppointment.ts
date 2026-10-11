"use client";

import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { AppointmentDetail } from "../types";

/** One appointment's detail (D160) — none asked while none is open. */
export function useAppointment(id: string | null) {
  return useApiQuery<AppointmentDetail>(id === null ? null : apiRoutes.appointments.one(id));
}
