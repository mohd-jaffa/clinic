"use client";

import { Ban, UserX } from "lucide-react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import type { AppointmentStatus } from "@/constants/statuses";
import { formatDayMonth, formatTime } from "@/lib/format/date";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { AppointmentsClient } from "../api.client";
import { appointmentRoutes } from "../keys";
import type { CalendarAppointment } from "../types";

const { appointment: words, appointments } = UI_TEXT;

/** What the card says once a status is set: who, and when they were booked for. */
const DONE: Partial<Record<AppointmentStatus, (patient: string, when: string) => string>> = {
  CONFIRMED: words.confirmed,
  CANCELLED: words.cancelled,
  NO_SHOW: words.markedNoShow,
};

/**
 * Setting an appointment's status from its detail (plan §11.2): **Confirm**
 * at a tap; **No-show** asking first, since it cannot go back to scheduled
 * (D163); **Cancel** with its reason, asking first on a coral card (D162).
 * Done, `onDone` closes what it was asked from, the card says so (D165), and
 * the calendar, the appointment and its patient's profile are read again.
 */
export function useStatusChange(appointment: CalendarAppointment, onDone: () => void) {
  const respond = useResponse();
  const when = appointments.bookedWhen(formatDayMonth(appointment.day), formatTime(appointment.scheduledAt));
  const change = useApiMutation(AppointmentsClient.setStatus, {
    revalidate: appointmentRoutes(appointment),
    onSuccess: (changed) => {
      onDone();
      // Only the statuses above are set from here.
      respond.success({ title: DONE[changed.status]!(appointment.patientName, when) });
    },
    onError: (failure) => respond.failure(failure, { title: words.notChanged }),
  });
  const { id, patientName } = appointment;

  return {
    submitting: change.submitting,
    confirm: () => change.submit({ id, status: "CONFIRMED" }),
    noShow: async () => {
      const sure = await respond.confirm({
        title: words.noShowAsk(patientName),
        message: words.noShowAskBody,
        confirmLabel: words.noShow,
        confirmIcon: UserX,
      });
      if (sure) await change.submit({ id, status: "NO_SHOW" });
    },
    cancel: async (reason: string) => {
      const sure = await respond.confirm({
        title: words.cancelAsk(patientName),
        message: words.cancelAskBody(when, appointment.doctorName ?? words.formerDoctor, reason),
        confirmLabel: words.cancel,
        confirmIcon: Ban,
        cancelLabel: words.keep,
        tone: "danger",
      });
      if (sure) await change.submit({ id, status: "CANCELLED", reason });
    },
  };
}
