"use client";

import { Fragment, useId, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Row, RowList, RowToken } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { UI_TEXT } from "@/constants/messages";
import { formatTime } from "@/lib/format/date";

import { kindOf } from "../describe";
import { useArrival } from "../hooks/useArrival";
import { RemindButton } from "./RemindButton";
import { lateBy, minutesSince } from "../queue";
import type { QueueAppointment } from "../types";

const { queue, calendar, appointment: words } = UI_TEXT;

/** A token as the queue shows it, in display numerals: "07". */
export const tokenNumeral = (token: number | null) => (token === null ? "" : String(token).padStart(2, "0"));

/** A row's line: its parts that hold something, a dot between — read whole, so it may run onto a second line. */
function line(...parts: ReactNode[]) {
  const shown = parts.filter(Boolean);
  return shown.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && " · "}
      {part}
    </Fragment>
  ));
}

/** The doctor's name — or that they are gone — when every doctor's queue is shown. */
const doctorOf = (appointment: QueueAppointment, shown: boolean) =>
  shown ? (appointment.doctorName ?? words.formerDoctor) : null;

/**
 * One of the queue's sections (plan §11.4, D168): its title with how many it
 * holds, then its rows — or a quiet line when it holds none.
 */
export function QueueSection({
  title,
  count,
  empty,
  className,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={className}>
      <SectionHeading id={headingId} title={title} count={count} />
      {count === 0 ? <p className="text-small text-muted">{empty}</p> : <RowList label={title}>{children}</RowList>}
    </section>
  );
}

/** A patient waiting (D168): their token, name, Walk-in or booked time, how long they have waited. */
export function WaitingRow({
  appointment,
  now,
  showDoctor,
  onOpen,
}: {
  appointment: QueueAppointment;
  now: Date;
  showDoctor: boolean;
  onOpen: (appointment: QueueAppointment) => void;
}) {
  return (
    <Row
      leading={<RowToken value={tokenNumeral(appointment.token)} label={queue.token} />}
      title={appointment.patientName}
      subtitle={line(
        appointment.source === "WALK_IN" ? calendar.walkIn : formatTime(appointment.scheduledAt),
        queue.minutes(minutesSince(appointment.arrivedAt, now)),
        doctorOf(appointment, showDoctor),
      )}
      wrap
      onClick={() => onOpen(appointment)}
    />
  );
}

/** A patient in with a doctor: their token, name, and how long they have been in. */
export function WithDoctorRow({
  appointment,
  now,
  onOpen,
}: {
  appointment: QueueAppointment;
  now: Date;
  onOpen: (appointment: QueueAppointment) => void;
}) {
  return (
    <Row
      leading={<RowToken value={tokenNumeral(appointment.token)} label={queue.token} />}
      title={appointment.patientName}
      subtitle={queue.withDoctorLine(
        appointment.doctorName ?? words.formerDoctor,
        queue.minutes(minutesSince(appointment.startedAt, now)),
      )}
      wrap
      onClick={() => onOpen(appointment)}
    />
  );
}

/**
 * A patient still to come today (D172, D174, D179): their booked time — and
 * how late, in coral words, once it has passed — their name and kind, and
 * whether they have been reminded; on the row, a WhatsApp reminder and
 * **Arrived** for whoever may.
 */
export function ComingRow({
  appointment,
  now,
  showDoctor,
  canRemind,
  canArrive,
  onOpen,
}: {
  appointment: QueueAppointment;
  now: Date;
  showDoctor: boolean;
  /** Who may change appointments, view-only or not (D181, D182). */
  canRemind: boolean;
  canArrive: boolean;
  onOpen: (appointment: QueueAppointment) => void;
}) {
  const late = lateBy(appointment, now);
  return (
    <Row
      look="quiet"
      title={appointment.patientName}
      subtitle={line(
        formatTime(appointment.scheduledAt),
        late !== null && <span className="font-bold text-coral">{queue.late(late)}</span>,
        kindOf(appointment),
        doctorOf(appointment, showDoctor),
        appointment.remindedAt && words.reminded,
      )}
      wrap
      trailing={
        (canRemind || canArrive) && (
          <>
            {canRemind && <RemindButton appointment={appointment} look="icon" />}
            {canArrive && <ArriveButton appointment={appointment} />}
          </>
        )
      }
      onClick={() => onOpen(appointment)}
    />
  );
}

/** **Arrived** on a row (D172), an outline beside the name: the patient takes their token, said on the card (D173). */
function ArriveButton({ appointment }: { appointment: QueueAppointment }) {
  const { arrive, arriving } = useArrival(appointment);
  return (
    <Button
      label={queue.arrived}
      aria-label={queue.markArrived(appointment.patientName)}
      variant="secondary"
      size="sm"
      loading={arriving}
      onClick={() => void arrive()}
    />
  );
}

/** A patient done today: their token, name, and when they were done. */
export function DoneRow({
  appointment,
  showDoctor,
  onOpen,
}: {
  appointment: QueueAppointment;
  showDoctor: boolean;
  onOpen: (appointment: QueueAppointment) => void;
}) {
  return (
    <Row
      look="quiet"
      leading={<RowToken value={tokenNumeral(appointment.token)} label={queue.token} />}
      title={appointment.patientName}
      subtitle={line(queue.doneAt(formatTime(appointment.completedAt)), doctorOf(appointment, showDoctor))}
      wrap
      onClick={() => onOpen(appointment)}
    />
  );
}
