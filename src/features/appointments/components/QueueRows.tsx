"use client";

import { Fragment, useId, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Row, RowList, RowToken } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { UI_TEXT } from "@/constants/messages";
import { visitRoute } from "@/constants/navigation";
import { formatTime } from "@/lib/format/date";

import { kindOf } from "../describe";
import { useArrival } from "../hooks/useArrival";
import { useDone, useNextPatient, useSendIn } from "../hooks/useQueueMoves";
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
 * holds, then its rows — or a quiet line when it holds none, and what may be
 * done about it (`action`: Next patient, with the room free).
 */
export function QueueSection({
  title,
  count,
  empty,
  action,
  className,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={className}>
      <SectionHeading id={headingId} title={title} count={count} />
      {count === 0 ? (
        <div className="grid justify-items-start gap-3">
          <p className="text-small text-muted">{empty}</p>
          {action}
        </div>
      ) : (
        <RowList label={title}>{children}</RowList>
      )}
    </section>
  );
}

/**
 * A patient waiting (D168, D172): their token, name, Walk-in or booked time,
 * how long they have waited — and that they stepped out (D198); on the row,
 * **Send in** for whoever may, asking first while the doctor has someone in
 * (D192).
 */
export function WaitingRow({
  appointment,
  now,
  showDoctor,
  inRoom,
  canMove,
  onOpen,
}: {
  appointment: QueueAppointment;
  now: Date;
  showDoctor: boolean;
  /** Who is in with a doctor now, so Send in can ask about their doctor's room. */
  inRoom: readonly QueueAppointment[];
  canMove: boolean;
  onOpen: (appointment: QueueAppointment) => void;
}) {
  return (
    <Row
      look={appointment.steppedOutAt ? "quiet" : "surface"}
      leading={<RowToken value={tokenNumeral(appointment.token)} label={queue.token} />}
      title={appointment.patientName}
      subtitle={line(
        appointment.steppedOutAt && <span className="font-bold text-ink">{queue.steppedOut}</span>,
        appointment.source === "WALK_IN" ? calendar.walkIn : formatTime(appointment.scheduledAt),
        queue.minutes(minutesSince(appointment.arrivedAt, now)),
        doctorOf(appointment, showDoctor),
      )}
      wrap
      trailing={canMove && <SendInButton appointment={appointment} inRoom={inRoom} />}
      onClick={() => onOpen(appointment)}
    />
  );
}

/** **Send in** on a waiting row (D172, D192). */
function SendInButton({ appointment, inRoom }: { appointment: QueueAppointment; inRoom: readonly QueueAppointment[] }) {
  const { sendIn, sending } = useSendIn(appointment, { inRoom });
  return (
    <Button
      label={queue.sendIn}
      aria-label={queue.sendInOf(appointment.patientName)}
      size="sm"
      loading={sending}
      onClick={() => void sendIn()}
    />
  );
}

/**
 * A patient in with a doctor: their token, name, and how long they have been
 * in; on the row, **Done** and **Next patient** for whoever may (D193). It
 * opens their visit for whoever reads visits (D195), or the appointment's
 * detail.
 */
export function WithDoctorRow({
  appointment,
  now,
  canMove,
  onOpen,
}: {
  appointment: QueueAppointment;
  now: Date;
  canMove: boolean;
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
      trailing={canMove && <InRoomButtons appointment={appointment} />}
      {...(appointment.visitId ? { href: visitRoute(appointment.visitId) } : { onClick: () => onOpen(appointment) })}
    />
  );
}

/** **Done** and **Next patient** beside a patient in (D193, D196): the lake's and the With doctor row's. */
export function InRoomButtons({ appointment }: { appointment: QueueAppointment }) {
  const { done, marking } = useDone(appointment);
  const { next, moving } = useNextPatient({
    doctorId: appointment.doctorId,
    doctorName: appointment.doctorName,
    appointment,
  });
  return (
    <>
      <Button
        label={queue.done}
        aria-label={queue.doneOf(appointment.patientName)}
        variant="secondary"
        size="sm"
        loading={marking}
        disabled={moving}
        onClick={() => void done()}
      />
      <Button
        label={queue.nextPatient}
        aria-label={queue.nextPatientAfter(appointment.patientName)}
        size="sm"
        loading={moving}
        disabled={marking}
        onClick={() => void next()}
      />
    </>
  );
}

/** **Next patient** with the room free (D196): the doctor's lowest waiting token goes in. */
export function NextPatientButton({ doctorId, doctorName }: { doctorId: string; doctorName: string | null }) {
  const { next, moving } = useNextPatient({ doctorId, doctorName });
  return (
    <Button
      label={queue.nextPatient}
      aria-label={queue.nextPatientFor(doctorName ?? words.formerDoctor)}
      size="sm"
      loading={moving}
      onClick={() => void next()}
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
