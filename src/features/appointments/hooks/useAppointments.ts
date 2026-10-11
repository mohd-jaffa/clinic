"use client";

import { useApiQuery } from "@/lib/query/useApiQuery";

import { calendarKey } from "../keys";
import type { CalendarAppointment } from "../types";

/** The calendar's appointments (plan §11.5): the days asked, one doctor's or every doctor's (""). */
export function useAppointments(from: string, to: string, doctorId: string) {
  return useApiQuery<CalendarAppointment[]>(calendarKey(from, to, doctorId));
}
