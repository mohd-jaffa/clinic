"use client";

import { CalendarPlus } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { LoadFailed } from "@/components/ui/list-screen";
import { Row, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { hasAccess } from "@/constants/permissions";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from "@/constants/statuses";
import { BookingSheet } from "@/features/appointments/components/BookingSheet";
import { kindOf } from "@/features/appointments/describe";
import type { CalendarAppointment } from "@/features/appointments/types";
import { useAuth } from "@/features/auth/AuthProvider";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { formatLongDate, formatTime } from "@/lib/format/date";

import { usePatientSummary } from "../hooks/usePatientSummary";
import type { Patient } from "../types";

const { patients, appointment: words, appointments } = UI_TEXT;

/**
 * A patient's next appointment (plan §10.3, D166): its day, time, doctor and
 * kind, opening its detail — or that none is to come, with **Book** for
 * whoever may book while the clinic can write and the patient is not
 * archived (D103). Book opens the booking sheet here, for them; booked, the
 * section shows it.
 */
export function NextAppointment({
  patient,
  onOpen,
}: {
  patient: Patient;
  onOpen: (appointment: CalendarAppointment) => void;
}) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const summary = usePatientSummary(patient.id);
  const [booking, setBooking] = useState({ open: false, count: 0 });
  const headingId = useId();
  const canBook = membership !== null && hasAccess(membership, "appointments.create") && !patient.archivedAt;
  const next = summary.data?.nextAppointment;

  let body;
  if (summary.data === undefined) {
    body =
      summary.error != null ? (
        <LoadFailed query={summary} loadFailed="APPOINTMENTS_LOAD_FAILED" />
      ) : (
        <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
          <SkeletonRows rows={1} />
        </section>
      );
  } else if (next) {
    body = (
      <RowList label={patients.nextAppointment}>
        <Row
          title={formatLongDate(next.day)}
          subtitle={[formatTime(next.scheduledAt), next.doctorName ?? words.formerDoctor, kindOf(next)].join(" · ")}
          detail={
            <StatusPill label={APPOINTMENT_STATUS_LABELS[next.status]} tone={APPOINTMENT_STATUS_TONES[next.status]} />
          }
          onClick={() => onOpen(next)}
        />
      </RowList>
    );
  } else {
    body = (
      <div className="grid justify-items-start gap-3 rounded-row bg-surface px-5 py-4">
        <p className="text-muted">{patients.noNextAppointment}</p>
        {canBook && !readOnly && (
          <Button
            label={appointments.book}
            aria-label={patients.bookFor(patient.name)}
            icon={CalendarPlus}
            size="sm"
            onClick={() => setBooking(({ count }) => ({ open: true, count: count + 1 }))}
          />
        )}
        {canBook && <ReadOnlyNote />}
      </div>
    );
  }

  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} title={patients.nextAppointment} />
      {body}
      {canBook && !readOnly && (
        <BookingSheet
          key={booking.count}
          patient={{ id: patient.id, name: patient.name, number: patient.number }}
          open={booking.open}
          onClose={() => setBooking((now) => ({ ...now, open: false }))}
        />
      )}
    </section>
  );
}
