import { apiRoutes, withQuery } from "@/lib/query/keys";

/**
 * The calendar's key (plan §11.5): the days asked and the doctor — none for
 * every doctor — so the page's first read and the screen's hook ask for the
 * very same thing.
 */
export const calendarKey = (from: string, to: string, doctorId: string) =>
  withQuery(apiRoutes.appointments.list, { from, to, doctorId });

/**
 * Every read a change to an appointment makes stale: the calendar's days, the
 * doctors' taken times, the appointment itself, today's queue, and its
 * patient's next appointment and history.
 */
export const appointmentRoutes = ({ id, patientId }: { id: string; patientId: string }) => [
  apiRoutes.appointments.list,
  apiRoutes.appointments.booked,
  apiRoutes.appointments.one(id),
  apiRoutes.queue.list,
  apiRoutes.patients.summary(patientId),
  apiRoutes.patients.timeline(patientId),
];

/**
 * Today's queue's key (plan §11.4, D170): the doctor — none for every doctor —
 * so the page's first read and the screen's hook ask for the very same thing.
 */
export const queueKey = (doctorId: string) => withQuery(apiRoutes.queue.list, { doctorId });
