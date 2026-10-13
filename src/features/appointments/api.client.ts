import { patchJson, postJson, postOnce } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type {
  AppointmentChangeInput,
  BookingInput,
  NextPatientPayload,
  SendInPayload,
  StatusChangeInput,
  SteppedOutPayload,
  WalkInInput,
} from "@/lib/validation";

import type { AppointmentChanged, Arrival, Booked, NextPatient, SentIn, SteppedOut } from "./types";

/**
 * The appointments' endpoints the browser calls (plan §30): booking one, once
 * per key however often it is sent; changing one — its notes, or moved
 * (D161); setting its status from its detail; and a patient joining the
 * queue — a walk-in, once per key, or a booking arrived — with their token;
 * a reminder sent on WhatsApp, noted (D180); and the queue's moves (plan
 * §11.4): Send in, Done, Next patient, Back to waiting, Stepped out.
 */
export const AppointmentsClient = {
  book: ({ input, key }: { input: BookingInput; key: string }) =>
    postOnce<Booked>(apiRoutes.appointments.list, input, key),
  change: ({ id, input }: { id: string; input: AppointmentChangeInput }) =>
    patchJson<AppointmentChanged>(apiRoutes.appointments.one(id), input),
  setStatus: ({ id, ...change }: StatusChangeInput & { id: string }) =>
    postJson<AppointmentChanged>(apiRoutes.appointments.status(id), change),
  arrive: (id: string) => postJson<Arrival>(apiRoutes.appointments.arrived(id)),
  remind: (id: string) => postJson<{ remindedAt: string }>(apiRoutes.appointments.reminded(id)),
  addWalkIn: ({ input, key }: { input: WalkInInput; key: string }) =>
    postOnce<Arrival>(apiRoutes.appointments.walkIn, input, key),
  sendIn: (input: SendInPayload) => postJson<SentIn>(apiRoutes.queue.sendIn, input),
  done: (appointmentId: string) => postJson<{ appointmentId: string }>(apiRoutes.queue.done, { appointmentId }),
  next: (input: NextPatientPayload) => postJson<NextPatient>(apiRoutes.queue.next, input),
  backToWaiting: (appointmentId: string) =>
    postJson<{ appointmentId: string }>(apiRoutes.queue.waiting, { appointmentId }),
  stepOut: (input: SteppedOutPayload) => postJson<SteppedOut>(apiRoutes.queue.steppedOut, input),
};
