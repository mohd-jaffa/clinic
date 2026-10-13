"use client";

import {
  Ban,
  CalendarClock,
  Check,
  CheckCheck,
  CircleOff,
  DoorOpen,
  LogIn,
  LogOut,
  NotebookPen,
  Siren,
  Stethoscope,
  Undo2,
  UserRound,
  UserX,
} from "lucide-react";

import { Button, LinkButton } from "@/components/ui/button";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { LoadFailed } from "@/components/ui/list-screen";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { patientRoute, visitRoute } from "@/constants/navigation";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { dayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatLongDate, formatTime } from "@/lib/format/date";

import { actionsFor, NO_ACTIONS } from "../actions";
import { kindOf, timeOf } from "../describe";
import { useAppointment } from "../hooks/useAppointment";
import { useArrival } from "../hooks/useArrival";
import { useBackToWaiting, useDone, useSendIn, useStepOut, useUrgent } from "../hooks/useQueueMoves";
import { useStatusChange } from "../hooks/useStatusChange";
import { RemindButton } from "./RemindButton";
import { UrgentTag } from "./UrgentTag";
import type { AppointmentDetail, CalendarAppointment } from "../types";

const { appointment: words, patients, calendar } = UI_TEXT;

/** What its detail says of an appointment (D160), each line only when it holds something. */
function detailsOf(appointment: CalendarAppointment, detail: AppointmentDetail | undefined): Detail[] {
  const reminded = detail ? detail.remindedAt : appointment.remindedAt;
  const lines: [string, string | null | undefined][] = [
    [words.whenLabel, words.when(formatLongDate(appointment.day), timeOf(appointment))],
    [words.doctorLabel, appointment.doctorName ?? words.formerDoctor],
    [words.typeLabel, appointment.typeName],
    [words.tokenLabel, appointment.token === null ? null : calendar.token(appointment.token)],
    [words.notesLabel, detail?.notes],
    [
      appointment.source === "WALK_IN" ? words.addedLabel : words.bookedLabel,
      detail && words.by(detail.bookedBy, formatDayMonth(dayKey(detail.bookedAt))),
    ],
    [
      words.cancelledLabel,
      detail?.cancelledAt && words.by(detail.cancelledBy, formatDayMonth(dayKey(detail.cancelledAt))),
    ],
    [words.reasonLabel, detail?.cancelReason],
    [
      words.remindedLabel,
      // The detail as read now: a reminder sent with the sheet open shows at once.
      reminded && words.when(formatDayMonth(dayKey(reminded)), formatTime(reminded)),
    ],
  ];
  return lines.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/**
 * An appointment's detail (plan §11.2; D160 – D165), opened from the calendar
 * or a patient's profile: who, when, with whom, what kind and where it
 * stands, its notes, who booked it — and who cancelled it and why. Under it,
 * what its status allows the one looking: **Arrived** on its day, giving the
 * token (D164); **Remind on WhatsApp** a booking still to come (D179);
 * **Confirm**, **Reschedule** (or **Edit notes** once it cannot move),
 * **No-show** once its time has come, **Cancel appointment**; the queue's
 * moves — **Send in** and **Stepped out** or **Back** for a patient waiting,
 * **Done** and **Back to waiting** for one in (D197, D198) — **Urgent** for
 * one waiting and **Not urgent** till they are done, with the tag beside the
 * status (D201), and **Open visit** once there is one (D195). An archived patient's appointment says
 * why it offers nothing but its visit (D103); a read-only clinic, why nothing
 * can change — though a reminder may still be sent (D181), and a visit read.
 *
 * It opens on what the calendar already holds, and fills in as the rest
 * arrives. Arrived, Confirm, No-show and the queue's moves close it, with a
 * card (D165, D173).
 */
export function AppointmentSheet({
  appointment,
  open,
  onClose,
  onReschedule,
  onEditNotes,
  onCancel,
  linkProfile,
}: {
  appointment: CalendarAppointment;
  open: boolean;
  onClose: () => void;
  onReschedule: (detail: AppointmentDetail) => void;
  onEditNotes: (detail: AppointmentDetail) => void;
  onCancel: () => void;
  /** Offer **Open profile** — not on the profile itself. */
  linkProfile: boolean;
}) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const query = useAppointment(appointment.id);
  const detail = query.data;
  const status = useStatusChange(appointment, onClose);
  const arrival = useArrival(appointment, onClose);
  const moved = detail ?? appointment;
  const sending = useSendIn(appointment, { onDone: onClose });
  const marking = useDone(moved, onClose);
  const returning = useBackToWaiting(moved, onClose);
  const stepping = useStepOut(appointment, onClose);
  const urgency = useUrgent(moved, onClose);
  const offered = detail && membership ? actionsFor(detail, membership) : undefined;
  const any = offered !== undefined && Object.values({ ...offered, openVisit: false }).some(Boolean);
  // A view-only clinic changes nothing, but a reminder is sharing what is there (D181), and a visit is read.
  const actions =
    offered && readOnly ? { ...NO_ACTIONS, remind: offered.remind, openVisit: offered.openVisit } : offered;

  let footer;
  if (actions && Object.values(actions).some(Boolean)) {
    footer = (
      <div role="group" aria-label={words.actions} className="flex flex-wrap gap-2">
        {actions.sendIn && (
          <Button
            label={UI_TEXT.queue.sendIn}
            icon={LogIn}
            size="sm"
            loading={sending.sending}
            onClick={() => void sending.sendIn()}
          />
        )}
        {actions.done && (
          <Button
            label={UI_TEXT.queue.done}
            icon={CheckCheck}
            size="sm"
            loading={marking.marking}
            onClick={() => void marking.done()}
          />
        )}
        {actions.openVisit && (
          <LinkButton
            href={visitRoute(detail!.visitId!)}
            label={UI_TEXT.queue.openVisit}
            accessibleName={UI_TEXT.queue.openVisitOf(appointment.patientName)}
            icon={Stethoscope}
            variant={actions.done || actions.sendIn ? "secondary" : "primary"}
            size="sm"
          />
        )}
        {actions.backToWaiting && (
          <Button
            label={UI_TEXT.queue.backToWaiting}
            icon={Undo2}
            variant="secondary"
            size="sm"
            loading={returning.moving}
            onClick={() => void returning.backToWaiting()}
          />
        )}
        {actions.stepOut && (
          <Button
            label={UI_TEXT.queue.stepOut}
            icon={LogOut}
            variant="secondary"
            size="sm"
            loading={stepping.stepping}
            onClick={() => void stepping.stepOut()}
          />
        )}
        {actions.stepBack && (
          <Button
            label={UI_TEXT.queue.stepBack}
            aria-label={UI_TEXT.queue.stepBackOf(appointment.patientName)}
            icon={DoorOpen}
            variant="secondary"
            size="sm"
            loading={stepping.stepping}
            onClick={() => void stepping.stepBack()}
          />
        )}
        {actions.markUrgent && (
          <Button
            label={UI_TEXT.queue.urgent}
            aria-label={UI_TEXT.queue.urgentOf(appointment.patientName)}
            icon={Siren}
            variant="secondary"
            size="sm"
            loading={urgency.marking}
            onClick={() => void urgency.markUrgent()}
          />
        )}
        {actions.unmarkUrgent && (
          <Button
            label={UI_TEXT.queue.notUrgent}
            aria-label={UI_TEXT.queue.notUrgentOf(appointment.patientName)}
            icon={CircleOff}
            variant="secondary"
            size="sm"
            loading={urgency.marking}
            onClick={() => void urgency.unmarkUrgent()}
          />
        )}
        {actions.arrive && (
          <Button
            label={UI_TEXT.queue.arrived}
            icon={DoorOpen}
            size="sm"
            loading={arrival.arriving}
            onClick={() => void arrival.arrive()}
          />
        )}
        {actions.confirm && (
          <Button
            label={words.confirm}
            icon={Check}
            // On its day, Arrived leads.
            variant={actions.arrive ? "secondary" : "primary"}
            size="sm"
            loading={status.submitting}
            onClick={() => void status.confirm()}
          />
        )}
        {actions.remind && <RemindButton appointment={appointment} look="capsule" />}
        {actions.reschedule && (
          <Button
            label={words.reschedule}
            icon={CalendarClock}
            variant="secondary"
            size="sm"
            onClick={() => onReschedule(detail!)}
          />
        )}
        {actions.editNotes && (
          <Button
            label={words.editNotes}
            icon={NotebookPen}
            variant="secondary"
            size="sm"
            onClick={() => onEditNotes(detail!)}
          />
        )}
        {actions.noShow && (
          <Button
            label={words.noShow}
            icon={UserX}
            variant="secondary"
            size="sm"
            disabled={status.submitting}
            onClick={() => void status.noShow()}
          />
        )}
        {actions.cancel && <Button label={words.cancel} icon={Ban} variant="danger" size="sm" onClick={onCancel} />}
      </div>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={appointment.patientName} footer={footer}>
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusPill
            label={APPOINTMENT_STATUS_LABELS[appointment.status]}
            tone={APPOINTMENT_STATUS_TONES[appointment.status]}
          />
          {detail?.urgentAt && <UrgentTag />}
          <span className="text-small text-muted">
            {patients.number(appointment.patientNumber)} · {kindOf(appointment)}
          </span>
        </div>
        <DetailList details={detailsOf(appointment, detail)} />
        {detail === undefined &&
          (query.error != null ? (
            <LoadFailed query={query} loadFailed="APPOINTMENT_LOAD_FAILED" />
          ) : (
            <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
              <SkeletonRows rows={1} />
            </section>
          ))}
        {detail?.patientArchived && <p className="text-small text-muted">{words.archivedNote}</p>}
        {any && <ReadOnlyNote />}
        {linkProfile && (
          <div>
            <LinkButton
              href={patientRoute(appointment.patientId)}
              label={words.openProfile}
              accessibleName={words.openProfileOf(appointment.patientName)}
              icon={UserRound}
              variant="quiet"
              size="sm"
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}
