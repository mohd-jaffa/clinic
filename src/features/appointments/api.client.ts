import { postOnce } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { BookingInput } from "@/lib/validation";

import type { Booked } from "./types";

/** The appointments' endpoints the browser calls (plan §30): booking one, once per key however often it is sent. */
export const AppointmentsClient = {
  book: ({ input, key }: { input: BookingInput; key: string }) =>
    postOnce<Booked>(apiRoutes.appointments.list, input, key),
};
