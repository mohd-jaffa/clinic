import type { AppointmentDetail, CalendarAppointment, QueueAppointment } from "@/features/appointments/types";

/** An appointment as the calendar reads it, for a component test. */
export function aCalendarAppointment(overrides: Partial<CalendarAppointment> = {}): CalendarAppointment {
  return {
    id: "a-1",
    patientId: "p-1",
    patientName: "Rohan Mehta",
    patientNumber: 1012,
    patientPhone: "+919876543210",
    doctorId: "d-1",
    doctorName: "Maya Rao",
    typeName: "Consultation",
    source: "BOOKED",
    status: "SCHEDULED",
    scheduledAt: "2026-10-13T03:30:00Z",
    minutes: 15,
    day: "2026-10-13",
    token: null,
    remindedAt: null,
    ...overrides,
  };
}

/** An appointment's detail (D160), for a component test: the calendar's, with what it says of itself. */
export function anAppointmentDetail(overrides: Partial<AppointmentDetail> = {}): AppointmentDetail {
  return {
    ...aCalendarAppointment(),
    typeId: "t-1",
    patientArchived: false,
    notes: null,
    bookedAt: "2026-10-10T06:00:00Z",
    bookedBy: "Priya Nair",
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    ...overrides,
  };
}

/** An appointment as today's queue reads it, for a component test. */
export function aQueueAppointment(overrides: Partial<QueueAppointment> = {}): QueueAppointment {
  return { ...aCalendarAppointment(), arrivedAt: null, startedAt: null, completedAt: null, ...overrides };
}
