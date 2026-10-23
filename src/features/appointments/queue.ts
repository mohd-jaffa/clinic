import type { QueueAppointment } from "./types";

/** Today's queue in its sections (plan §11.4, D168). */
export interface QueueSections {
  /** In with a doctor, the longest in first. */
  withDoctor: QueueAppointment[];
  /** Arrived, by token (D141): any may be sent in, not only the lowest. */
  waiting: QueueAppointment[];
  /** Booked for today and not here yet, by time — those past their time too, until marked (D174). */
  stillToCome: QueueAppointment[];
  /** Finished today, the latest first — once settled, beside To bill (D339). */
  done: QueueAppointment[];
}

const at = (instant: string | null) => (instant === null ? 0 : Date.parse(instant));

/**
 * Sorts today's queue into its sections, each in its own order. Beside the
 * To bill section (`toBill`, D318), a patient done reaches Done once their
 * visit is billed or marked No charge, so no one is listed twice (D339).
 */
export function queueSections(
  appointments: readonly QueueAppointment[],
  { toBill = false }: { toBill?: boolean } = {},
): QueueSections {
  const of = (...statuses: QueueAppointment["status"][]) =>
    appointments.filter((appointment) => statuses.includes(appointment.status));
  return {
    withDoctor: of("IN_PROGRESS").sort((a, b) => at(a.startedAt) - at(b.startedAt)),
    waiting: of("ARRIVED").sort(
      (a, b) => (a.token ?? Infinity) - (b.token ?? Infinity) || at(a.arrivedAt) - at(b.arrivedAt),
    ),
    stillToCome: of("SCHEDULED", "CONFIRMED").sort((a, b) => at(a.scheduledAt) - at(b.scheduledAt)),
    done: of("COMPLETED")
      .filter((appointment) => !toBill || appointment.billingStatus !== "TO_BILL")
      .sort((a, b) => at(b.completedAt) - at(a.completedAt)),
  };
}

/** Whole minutes from an instant to now — how long a patient has waited, or been in. */
export function minutesSince(instant: string | null, now: Date): number {
  return instant === null ? 0 : Math.max(0, Math.floor((now.getTime() - Date.parse(instant)) / 60_000));
}

/** How late a patient still to come is (D174): whole minutes past their booked time, or none before it. */
export function lateBy(appointment: Pick<QueueAppointment, "scheduledAt">, now: Date): number | null {
  const minutes = minutesSince(appointment.scheduledAt, now);
  return minutes >= 1 ? minutes : null;
}

/**
 * Which doctor a walk-in starts on (D175): the one whose queue is showing;
 * on every doctor's, the member adding it when they are one of the doctors;
 * else the clinic's only doctor; else none, to be chosen.
 */
export function walkInDoctor({
  queueDoctor,
  ownDoctor,
  doctors,
}: {
  queueDoctor: string;
  ownDoctor: string | null;
  doctors: readonly { id: string }[];
}): string {
  if (queueDoctor) return queueDoctor;
  if (ownDoctor && doctors.some((doctor) => doctor.id === ownDoctor)) return ownDoctor;
  return doctors.length === 1 ? doctors[0].id : "";
}
