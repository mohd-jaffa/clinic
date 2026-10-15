"use client";

import { CalendarDays } from "lucide-react";
import { useId } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { Row, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { HISTORY_MEDICINES_NAMED, HISTORY_TREATMENTS_NAMED } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { VISIT_FROM, visitRoute } from "@/constants/navigation";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_TONES,
} from "@/constants/statuses";
import { isLive } from "@/features/appointments/calendar";
import { kindOf } from "@/features/appointments/describe";
import type { CalendarAppointment, PatientAppointment } from "@/features/appointments/types";
import type { PatientVisit } from "@/features/visits/types";
import { formatDate, formatTime } from "@/lib/format/date";

import { usePatientTimeline } from "../hooks/usePatientTimeline";
import type { Patient } from "../types";

const { patients, appointment: words } = UI_TEXT;

/**
 * A patient's history (plan §10.3; D167, D225 – D227): one list, newest
 * first, a page at a time — their visits, each standing for the appointment
 * it was opened for, and the appointments that have none: those still to
 * come, cancelled or missed. A visit says its day, its doctor, what it found
 * and its medicines, or that it holds nothing, and opens its screen; an
 * appointment says its day and time, its doctor and kind, where it stands —
 * a cancelled one why, quiet like a no-show — and opens its detail. Each part
 * only for those who may see it; bills and payments join it in Phase 8
 * (D101).
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
        loadFailed="HISTORY_LOAD_FAILED"
        data={query.data}
        empty={<EmptyState icon={CalendarDays} title={patients.historyEmpty} hint={patients.historyEmptyHint} />}
        renderList={(entries) => (
          <RowList label={patients.history}>
            {entries.map((entry) =>
              "visit" in entry ? (
                <VisitRow key={entry.visit.id} visit={entry.visit} />
              ) : (
                <AppointmentRow key={entry.appointment.id} appointment={entry.appointment} onOpen={onOpen} />
              ),
            )}
          </RowList>
        )}
      />
    </section>
  );
}

/**
 * A visit (D226): its day and doctor, the diagnosis — or the complaint — and
 * its medicines by name, or "Nothing recorded"; under them, the treatments
 * it worked on or began (D262); opening its screen, which leads back here
 * (D227, D230).
 */
function VisitRow({ visit }: { visit: PatientVisit }) {
  const named = visit.medicines.slice(0, HISTORY_MEDICINES_NAMED);
  const worked = visit.treatments.slice(0, HISTORY_TREATMENTS_NAMED);
  return (
    <Row
      title={patients.visitOn(formatDate(visit.day))}
      subtitle={[
        visit.doctorName ?? words.formerDoctor,
        visit.finding ?? (visit.recorded ? null : patients.nothingRecorded),
      ]
        .filter(Boolean)
        .join(" · ")}
      note={[
        named.length > 0 && patients.medicines(named, visit.medicines.length - named.length),
        worked.length > 0 && UI_TEXT.treatments.worked(worked, visit.treatments.length - worked.length),
      ]}
      detail={<StatusPill label={VISIT_STATUS_LABELS[visit.status]} tone={VISIT_STATUS_TONES[visit.status]} />}
      href={visitRoute(visit.id, VISIT_FROM.patient)}
    />
  );
}

/** An appointment with no visit (D167): quiet once it is no longer in play. */
function AppointmentRow({
  appointment,
  onOpen,
}: {
  appointment: PatientAppointment;
  onOpen: (appointment: CalendarAppointment) => void;
}) {
  return (
    <Row
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
  );
}
