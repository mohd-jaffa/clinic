import type { CalendarAppointment } from "@/features/appointments/types";

/** An appointment as the calendar reads it, for a component test. */
export function aCalendarAppointment(overrides: Partial<CalendarAppointment> = {}): CalendarAppointment {
  return {
    id: "a-1",
    patientId: "p-1",
    patientName: "Rohan Mehta",
    patientNumber: 1012,
    doctorId: "d-1",
    doctorName: "Maya Rao",
    typeName: "Consultation",
    source: "BOOKED",
    status: "SCHEDULED",
    scheduledAt: "2026-10-13T03:30:00Z",
    minutes: 15,
    day: "2026-10-13",
    token: null,
    ...overrides,
  };
}
