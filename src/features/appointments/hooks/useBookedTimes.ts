"use client";

import { apiRoutes, withQuery } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import type { BookedTime } from "../types";

/** A doctor's taken times on a day (D147), asked once both are chosen. */
export function useBookedTimes(doctorId: string, date: string) {
  return useApiQuery<BookedTime[]>(
    doctorId && date ? withQuery(apiRoutes.appointments.booked, { doctorId, date }) : null,
  );
}
