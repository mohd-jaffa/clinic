"use client";

import { apiRoutes, withQuery } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";
import { closureDaysSchema, type ClosureDaysInput } from "@/lib/validation";

import type { ClosureAppointments } from "../types";

/**
 * The appointments on the days of a holiday or leave being added (D137),
 * asked once the days picked make a closure that could be saved — never for
 * half a choice.
 */
export function useClosureAppointments(days: ClosureDaysInput) {
  const ready = closureDaysSchema.safeParse(days).success;
  return useApiQuery<ClosureAppointments>(ready ? withQuery(apiRoutes.closures.appointments, { ...days }) : null);
}
