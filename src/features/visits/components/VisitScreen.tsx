"use client";

import { CoastHeader } from "@/components/ui/coast-header";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { Lake } from "@/components/ui/lake";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { QUEUE_REFRESH_MS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { QUEUE_ROUTE } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { BILLING_STATUS_LABELS, VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from "@/constants/statuses";
import { tokenNumeral } from "@/features/appointments/components/QueueRows";
import { UrgentTag } from "@/features/appointments/components/UrgentTag";
import { useDone, useNextPatient, type QueueParty } from "@/features/appointments/hooks/useQueueMoves";
import { minutesSince } from "@/features/appointments/queue";
import { useAuth } from "@/features/auth/AuthProvider";
import { describePatient } from "@/features/patients/describe";
import { AlertChips } from "@/features/patients/components/AlertChips";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useNow } from "@/hooks/useNow";
import { formatLongDate, formatTime } from "@/lib/format/date";
import { Button } from "@/components/ui/button";

import { useVisit } from "../hooks/useVisit";
import type { VisitHeader } from "../types";

const { visit: words, queue, appointment } = UI_TEXT;

/** What the visit's detail says (D195), each line only when it holds something. */
function detailsOf(visit: VisitHeader): Detail[] {
  const lines: [string, string | null][] = [
    [words.dayLabel, formatLongDate(visit.day)],
    [words.tokenLabel, visit.appointment?.token ? tokenNumeral(visit.appointment.token) : null],
    [words.startedLabel, formatTime(visit.startedAt)],
    [words.doneLabel, visit.completedAt && formatTime(visit.completedAt)],
    [words.billingLabel, visit.billingStatus && BILLING_STATUS_LABELS[visit.billingStatus]],
  ];
  return lines.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/**
 * A visit's screen — `/visits/[id]` (plan §12.2; D195): the patient, their
 * doctor and their alerts — and Urgent, for a patient marked so (D201) —
 * always in view; while they are in, the lake with
 * their token and how long they have been in, and **Done** and **Next
 * patient** for whoever may move the queue (D193). Next patient opens the
 * next patient's visit, or the queue when no one is waiting (D194). Vitals,
 * notes and the rest of the visit come with R6.2.
 */
export function VisitScreen({ id }: { id: string }) {
  const query = useVisit(id);
  const visit = query.data;
  return (
    <>
      <CoastHeader>
        <div className="grid gap-4 pb-6">
          <PageHeader
            title={visit?.patient.name ?? words.title}
            subtitle={visit && describePatient(visit.patient)}
            detail={visit && words.withDoctor(visit.doctorName ?? appointment.formerDoctor)}
            actions={
              visit && (
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill label={VISIT_STATUS_LABELS[visit.status]} tone={VISIT_STATUS_TONES[visit.status]} />
                  {visit.appointment?.urgentAt && <UrgentTag />}
                  {visit.alerts.length > 0 ? (
                    <AlertChips alerts={visit.alerts} />
                  ) : (
                    <span className="text-small text-land-muted">{UI_TEXT.alerts.none}</span>
                  )}
                </div>
              )
            }
            back={QUEUE_ROUTE}
          />
          {visit?.appointment?.status === "IN_PROGRESS" && <InRoom visit={visit} appointment={visit.appointment} />}
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        {visit ? (
          <DetailList details={detailsOf(visit)} />
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed="VISIT_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={3} />
          </section>
        )}
      </div>
    </>
  );
}

/** The patient in, in the lake (plan §32.1): their token, since when and for how long, and **Done** and **Next patient** (D193). */
function InRoom({
  visit,
  appointment: inRoom,
}: {
  visit: VisitHeader;
  appointment: NonNullable<VisitHeader["appointment"]>;
}) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const now = useNow(QUEUE_REFRESH_MS);
  const party: QueueParty = {
    id: inRoom.id,
    patientId: visit.patient.id,
    patientName: visit.patient.name,
    doctorId: visit.doctorId,
    doctorName: visit.doctorName,
    visitId: visit.id,
  };
  const { done, marking } = useDone(party);
  const { next, moving } = useNextPatient({
    doctorId: visit.doctorId,
    doctorName: visit.doctorName,
    appointment: party,
    fromVisit: true,
  });
  const edits = membership !== null && hasAccess(membership, "appointments.edit");
  return (
    <Lake
      label={`${queue.withDoctor}: ${visit.patient.name}`}
      lead={inRoom.token ? tokenNumeral(inRoom.token) : undefined}
      leadLabel={queue.token}
      title={words.since(formatTime(visit.startedAt))}
      detail={queue.minutes(minutesSince(visit.startedAt, now))}
    >
      {edits && !readOnly && (
        <>
          <Button
            label={queue.done}
            aria-label={queue.doneOf(visit.patient.name)}
            variant="secondary"
            size="sm"
            loading={marking}
            disabled={moving}
            onClick={() => void done()}
          />
          <Button
            label={queue.nextPatient}
            aria-label={queue.nextPatientAfter(visit.patient.name)}
            size="sm"
            loading={moving}
            disabled={marking}
            onClick={() => void next()}
          />
        </>
      )}
      {edits && <ReadOnlyNote />}
    </Lake>
  );
}
