"use client";

import { Ban, CalendarClock, Check, DoorOpen, NotebookPen, UserRound, UserX } from "lucide-react";

import { Button, LinkButton } from "@/components/ui/button";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { LoadFailed } from "@/components/ui/list-screen";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { patientRoute } from "@/constants/navigation";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { dayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatLongDate } from "@/lib/format/date";

import { actionsFor } from "../actions";
import { kindOf, timeOf } from "../describe";
import { useAppointment } from "../hooks/useAppointment";
import { useArrival } from "../hooks/useArrival";
import { useStatusChange } from "../hooks/useStatusChange";
import type { AppointmentDetail, CalendarAppointment } from "../types";

const { appointment: words, patients, calendar } = UI_TEXT;

/** What its detail says of an appointment (D160), each line only when it holds something. */
function detailsOf(appointment: CalendarAppointment, detail: AppointmentDetail | undefined): Detail[] {
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
  ];
  return lines.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/**
 * An appointment's detail (plan §11.2; D160 – D165), opened from the calendar
 * or a patient's profile: who, when, with whom, what kind and where it
 * stands, its notes, who booked it — and who cancelled it and why. Under it,
 * what its status allows the one looking: **Arrived** on its day, giving the
 * token (D164); **Confirm**, **Reschedule** (or **Edit notes** once it cannot
 * move), **No-show** once its time has come, **Cancel appointment**. An archived patient's appointment says why it
 * offers nothing (D103); a read-only clinic, why nothing can change.
 *
 * It opens on what the calendar already holds, and fills in as the rest
 * arrives. Arrived, Confirm and No-show close it, with a card (D165, D173).
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
  const actions = detail && membership ? actionsFor(detail, membership) : undefined;
  const any = actions !== undefined && Object.values(actions).some(Boolean);

  let footer;
  if (actions && any && !readOnly) {
    footer = (
      <div role="group" aria-label={words.actions} className="flex flex-wrap gap-2">
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
