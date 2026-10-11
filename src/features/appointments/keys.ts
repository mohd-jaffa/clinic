import { apiRoutes, withQuery } from "@/lib/query/keys";

/**
 * The calendar's key (plan §11.5): the days asked and the doctor — none for
 * every doctor — so the page's first read and the screen's hook ask for the
 * very same thing.
 */
export const calendarKey = (from: string, to: string, doctorId: string) =>
  withQuery(apiRoutes.appointments.list, { from, to, doctorId });
