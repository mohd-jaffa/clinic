"use client";

import { CheckCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { QUEUE_ROUTE, visitRoute } from "@/constants/navigation";
import type { SendInChoice } from "@/constants/statuses";
import { ApiError } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { useRevalidate } from "@/lib/query/useRevalidate";

import { AppointmentsClient } from "../api.client";
import { appointmentRoutes } from "../keys";
import type { CalendarAppointment, QueueAppointment } from "../types";

/** Who a move is for, as each screen holds them — a queue row, an appointment's detail, a visit's header. */
export type QueueParty = Pick<CalendarAppointment, "id" | "patientId" | "patientName" | "doctorId" | "doctorName"> & {
  visitId?: string | null;
};

const { queue, appointment: words } = UI_TEXT;

/** Names read as one: "Rahul Mehta", "Rahul Mehta and Meena Iyer", "A, B and C". */
const listOf = (names: readonly string[]) =>
  new Intl.ListFormat("en-IN", { style: "long", type: "conjunction" }).format(names);

/**
 * Every read a queue move makes stale: the appointment's, the queue's, the
 * visit's, once it has one — and To bill with its count, which a patient
 * done joins (D318, D337).
 */
const movedRoutes = (appointment: QueueParty) => [
  ...appointmentRoutes(appointment),
  ...(appointment.visitId ? [apiRoutes.visits.one(appointment.visitId)] : []),
  apiRoutes.toBill.list,
  apiRoutes.toBill.count,
];

/**
 * **Send in** (plan §11.4, D192): any waiting patient. While their doctor has
 * someone in — `inRoom`, the queue's — the card asks first: **Mark done and
 * send in**, or **Keep both in** for a second chair. Should another desk send
 * someone in meanwhile, the database refuses, and the card asks then. Done,
 * `onDone` closes what it was asked from, and the card says who is in.
 */
export function useSendIn(
  appointment: QueueParty,
  { inRoom = [], onDone }: { inRoom?: readonly QueueAppointment[]; onDone?: () => void } = {},
) {
  const respond = useResponse();
  const refresh = useRevalidate();
  const doctor = appointment.doctorName ?? words.formerDoctor;
  const others = inRoom.filter((other) => other.doctorId === appointment.doctorId && other.id !== appointment.id);

  /** What becomes of those in: marked done, kept in, or nothing — the desk said no. */
  const ask = async (names: readonly string[]): Promise<SendInChoice | null> => {
    let keep = false;
    const finish = await respond.confirm({
      title: names.length > 0 ? queue.roomBusy(listOf(names), names.length > 1, doctor) : queue.roomTaken(doctor),
      message: queue.roomBusyBody(appointment.patientName),
      confirmLabel: queue.finishAndSendIn,
      confirmIcon: CheckCheck,
      secondary: {
        label: queue.keepBothIn,
        icon: Users,
        onClick: () => {
          keep = true;
        },
      },
    });
    if (finish) return "FINISH";
    return keep ? "KEEP" : null;
  };

  const sending = useApiMutation(AppointmentsClient.sendIn, {
    revalidate: movedRoutes(appointment),
    onSuccess: () => {
      onDone?.();
      respond.success({ title: queue.sentIn(appointment.patientName, doctor) });
    },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === "DOCTOR_ROOM_TAKEN") {
        void refresh([apiRoutes.queue.list]);
        void ask([]).then((choice) => choice && sending.submit({ appointmentId: appointment.id, others: choice }));
        return;
      }
      respond.failure(failure, { title: queue.notSentIn });
    },
  });

  return {
    sending: sending.submitting,
    sendIn: async () => {
      if (others.length === 0) {
        await sending.submit({ appointmentId: appointment.id });
        return;
      }
      const choice = await ask(others.map((other) => other.patientName));
      if (choice) await sending.submit({ appointmentId: appointment.id, others: choice });
    },
  };
}

/** **Done** (plan §11.4, D43): the patient in is done, their visit closed as To bill; the card says so. */
export function useDone(appointment: QueueParty, onDone?: () => void) {
  const respond = useResponse();
  const marking = useApiMutation(AppointmentsClient.done, {
    revalidate: movedRoutes(appointment),
    onSuccess: () => {
      onDone?.();
      respond.success({ title: queue.markedDone(appointment.patientName) });
    },
    onError: (failure) => respond.failure(failure, { title: queue.notDone }),
  });
  return { marking: marking.submitting, done: () => marking.submit(appointment.id) };
}

/**
 * **Next patient** (D193, D194, D196): the patient it is for — none with the
 * room free — is done, and the doctor's lowest waiting token goes in. From the
 * visit screen (`fromVisit`) the next patient's visit opens, or the queue
 * when no one is waiting; from the queue, the queue stays. The card says who
 * is in, or that no one is waiting.
 */
export function useNextPatient({
  doctorId,
  doctorName,
  appointment,
  fromVisit = false,
}: {
  doctorId: string;
  doctorName: string | null;
  appointment?: QueueParty;
  fromVisit?: boolean;
}) {
  const respond = useResponse();
  const router = useRouter();
  const next = useApiMutation(AppointmentsClient.next, {
    revalidate: appointment ? movedRoutes(appointment) : [apiRoutes.queue.list, apiRoutes.appointments.list],
    onSuccess: ({ sent }) => {
      if (sent === null) {
        respond.info({ title: queue.noOneWaiting, message: queue.noOneWaitingBody });
        if (fromVisit) router.push(QUEUE_ROUTE);
        return;
      }
      respond.success({ title: queue.sentIn(sent.patientName, doctorName ?? words.formerDoctor) });
      if (fromVisit) router.push(visitRoute(sent.visitId));
    },
    onError: (failure) => respond.failure(failure, { title: queue.notMoved }),
  });
  return {
    moving: next.submitting,
    next: () => next.submit({ doctorId, appointmentId: appointment?.id }),
  };
}

/** **Back to waiting** (D197): the patient waits again with their token; the card says so. */
export function useBackToWaiting(appointment: QueueParty, onDone?: () => void) {
  const respond = useResponse();
  const moving = useApiMutation(AppointmentsClient.backToWaiting, {
    revalidate: movedRoutes(appointment),
    onSuccess: () => {
      onDone?.();
      respond.success({ title: queue.waitingAgain(appointment.patientName) });
    },
    onError: (failure) => respond.failure(failure, { title: queue.notMoved }),
  });
  return { moving: moving.submitting, backToWaiting: () => moving.submit(appointment.id) };
}

/** **Stepped out** and **Back** (D198): a waiting patient away for a moment, skipped by Next patient. */
export function useStepOut(appointment: QueueParty, onDone?: () => void) {
  const respond = useResponse();
  const stepping = useApiMutation(AppointmentsClient.stepOut, {
    revalidate: appointmentRoutes(appointment),
    onSuccess: ({ steppedOutAt }) => {
      onDone?.();
      if (steppedOutAt) {
        respond.success({ title: queue.steppedOutCard(appointment.patientName), message: queue.steppedOutBody });
      } else {
        respond.success({ title: queue.backCard(appointment.patientName) });
      }
    },
    onError: (failure) => respond.failure(failure, { title: queue.notMoved }),
  });
  return {
    stepping: stepping.submitting,
    stepOut: () => stepping.submit({ appointmentId: appointment.id, out: true }),
    stepBack: () => stepping.submit({ appointmentId: appointment.id, out: false }),
  };
}

/** **Urgent** and **Not urgent** (D201): a tag the desk and the doctor see; Next patient still goes by token. */
export function useUrgent(appointment: QueueParty, onDone?: () => void) {
  const respond = useResponse();
  const marking = useApiMutation(AppointmentsClient.urgent, {
    revalidate: movedRoutes(appointment),
    onSuccess: ({ urgentAt }) => {
      onDone?.();
      if (urgentAt) {
        respond.success({ title: queue.urgentCard(appointment.patientName), message: queue.urgentBody });
      } else {
        respond.success({ title: queue.notUrgentCard(appointment.patientName) });
      }
    },
    onError: (failure) => respond.failure(failure, { title: queue.notMoved }),
  });
  return {
    marking: marking.submitting,
    markUrgent: () => marking.submit({ appointmentId: appointment.id, urgent: true }),
    unmarkUrgent: () => marking.submit({ appointmentId: appointment.id, urgent: false }),
  };
}
