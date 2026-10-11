"use client";

import { CalendarDays } from "lucide-react";
import { useId } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { Row, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from "@/constants/statuses";
import { isLive } from "@/features/appointments/calendar";
import { kindOf } from "@/features/appointments/describe";
import type { CalendarAppointment } from "@/features/appointments/types";
import { formatDate, formatTime } from "@/lib/format/date";

import { usePatientTimeline } from "../hooks/usePatientTimeline";
import type { Patient } from "../types";

const { patients, appointment: words } = UI_TEXT;

/**
 * A patient's history (plan §10.3, D167): for now their appointments, every
 * one, newest first — those still to come, then the past — a page at a
 * time. Each says its day and time, its doctor and kind, and where it
 * stands; a cancelled one why, quiet like a no-show. Each opens its detail.
 * Visits, bills and payments join it as their phases arrive (D101).
 */
export function PatientHistory({
  patient,
  onOpen,
}: {
  patient: Patient;
  onOpen: (appointment: CalendarAppointment) => void;
}) {
  const query = usePatientTimeline(patient.id);
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} title={patients.history} />
      <ListScreen
        query={query}
        loadFailed="APPOINTMENTS_LOAD_FAILED"
        data={query.data}
        empty={<EmptyState icon={CalendarDays} title={patients.historyEmpty} hint={patients.historyEmptyHint} />}
        renderList={(appointments) => (
          <RowList label={patients.history}>
            {appointments.map((appointment) => (
              <Row
                key={appointment.id}
                look={isLive(appointment.status) ? "surface" : "quiet"}
                title={words.when(formatDate(appointment.day), formatTime(appointment.scheduledAt))}
                subtitle={[appointment.doctorName ?? words.formerDoctor, kindOf(appointment), appointment.cancelReason]
                  .filter(Boolean)
                  .join(" · ")}
                detail={
                  <StatusPill
                    label={APPOINTMENT_STATUS_LABELS[appointment.status]}
                    tone={APPOINTMENT_STATUS_TONES[appointment.status]}
                  />
                }
                onClick={() => onOpen(appointment)}
              />
            ))}
          </RowList>
        )}
      />
    </section>
  );
}
