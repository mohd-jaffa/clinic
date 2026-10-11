"use client";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { AppointmentsClient } from "../api.client";
import { appointmentRoutes } from "../keys";
import type { CalendarAppointment } from "../types";

const { queue, appointment: words } = UI_TEXT;

/**
 * A booked patient marked **Arrived** (plan §11.3; D143, D164, D173): they
 * take the doctor's next token — or the one they hold today — and the card
 * gives it, to tell them: "Rohan Mehta is #7 with Maya Rao". Done, `onDone`
 * closes what it was asked from, and the queue, the calendar and the
 * patient's profile are read again.
 */
export function useArrival(appointment: CalendarAppointment, onDone?: () => void) {
  const respond = useResponse();
  const arriving = useApiMutation(AppointmentsClient.arrive, {
    revalidate: appointmentRoutes(appointment),
    onSuccess: (arrival) => {
      onDone?.();
      respond.success({
        title: queue.tokenGiven(appointment.patientName, arrival.token, appointment.doctorName ?? words.formerDoctor),
      });
    },
    onError: (failure) => respond.failure(failure, { title: queue.notArrived }),
  });
  return { arrive: () => arriving.submit(appointment.id), arriving: arriving.submitting };
}
