import { patchJson, postJson, postOnce } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { AppointmentChangeInput, BookingInput, StatusChangeInput } from "@/lib/validation";

import type { AppointmentChanged, Booked } from "./types";

/**
 * The appointments' endpoints the browser calls (plan §30): booking one, once
 * per key however often it is sent; changing one — its notes, or moved
 * (D161); and setting its status from its detail.
 */
export const AppointmentsClient = {
  book: ({ input, key }: { input: BookingInput; key: string }) =>
    postOnce<Booked>(apiRoutes.appointments.list, input, key),
  change: ({ id, input }: { id: string; input: AppointmentChangeInput }) =>
    patchJson<AppointmentChanged>(apiRoutes.appointments.one(id), input),
  setStatus: ({ id, ...change }: StatusChangeInput & { id: string }) =>
    postJson<AppointmentChanged>(apiRoutes.appointments.status(id), change),
};
