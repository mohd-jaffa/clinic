"use client";

import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { Lake } from "@/components/ui/lake";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { QUEUE_REFRESH_MS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { patientRoute, QUEUE_ROUTE, VISIT_FROM } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { BILLING_STATUS_LABELS, VISIT_STATUS_LABELS, VISIT_STATUS_TONES } from "@/constants/statuses";
import { tokenNumeral } from "@/features/appointments/components/QueueRows";
import { UrgentTag } from "@/features/appointments/components/UrgentTag";
import { useDone, useNextPatient, type QueueParty } from "@/features/appointments/hooks/useQueueMoves";
import { minutesSince } from "@/features/appointments/queue";
import { useAuth } from "@/features/auth/AuthProvider";
import { NewBillLink } from "@/features/billing/components/NewBillLink";
import { AlertChips } from "@/features/patients/components/AlertChips";
import { VisitAlerts } from "@/features/patients/components/PatientAlerts";
import { describePatient } from "@/features/patients/describe";
import { PrescriptionSection } from "@/features/prescriptions/components/PrescriptionSection";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { TreatmentsSection } from "@/features/treatments/components/TreatmentsSection";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useNow } from "@/hooks/useNow";
import { formatLongDate, formatTime } from "@/lib/format/date";
import { apiRoutes } from "@/lib/query/keys";

import { useVisit } from "../hooks/useVisit";
import { useFinishVisit } from "../hooks/useVisitMoves";
import type { Visit } from "../types";
import { FollowUpSection } from "./FollowUpSection";
import { NotesSection } from "./NotesSection";
import { VitalsSection } from "./VitalsSection";

const { visit: words, queue, appointment } = UI_TEXT;

/** What the visit's detail says (D195), each line only when it holds something. */
function detailsOf(visit: Visit): Detail[] {
  const lines: [string, string | null][] = [
    [words.dayLabel, formatLongDate(visit.day)],
    [words.tokenLabel, visit.appointment?.token ? tokenNumeral(visit.appointment.token) : null],
    [words.startedLabel, visit.startedAt && formatTime(visit.startedAt)],
    [words.doneLabel, visit.completedAt && formatTime(visit.completedAt)],
    [words.billingLabel, visit.billingStatus && BILLING_STATUS_LABELS[visit.billingStatus]],
  ];
  return lines.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/**
 * A visit's screen — `/visits/[id]` (plan §12.2; D195, D202 – D209). Its
 * land holds the patient, their doctor and their alerts — with **Alerts** to
 * change them mid-visit (D207) — and Urgent for a patient marked so (D201),
 * always in view; while they are in, the lake with their token and how long
 * they have been in, and **Done** and **Next patient** for whoever may move
 * the queue (D193) — or, for a visit started from their profile, **Done**
 * (D204). Next patient opens the next patient's visit, or the queue when no
 * one is waiting (D194).
 *
 * Under it, what the visit records, each section optional and saving alone
 * (D202): vitals, complaint, diagnosis and notes, the treatments (plan
 * §14.1, D256), the prescription (plan §13) and the follow-up — fields for
 * whoever may write them, read-outs for whoever may only read. A phone
 * stacks them; from a tablet the notes, the treatments and the prescription
 * stand beside the vitals and the follow-up (D209, D263). Then the visit's
 * own details, and **Bill now** at its foot (D307).
 *
 * Its back arrow leads to the queue — or, opened from the patient's profile
 * (their history, or New visit), back to the profile (D230).
 */
export function VisitScreen({ id }: { id: string }) {
  const query = useVisit(id);
  const visit = query.data;
  const fromProfile = useSearchParams().get(VISIT_FROM.param) === VISIT_FROM.patient;
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
                  <VisitAlerts
                    patientId={visit.patient.id}
                    archived={visit.patient.archived}
                    visitRoute={apiRoutes.visits.one(visit.id)}
                  />
                </div>
              )
            }
            back={fromProfile && visit ? patientRoute(visit.patient.id) : QUEUE_ROUTE}
          />
          {visit?.appointment?.status === "IN_PROGRESS" && <InRoom visit={visit} appointment={visit.appointment} />}
          {visit && visit.appointment === null && visit.status === "OPEN" && <StartedHere visit={visit} />}
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        {visit ? (
          <Records visit={visit} />
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

/**
 * What the visit records, each section for whoever may write it (D202): the
 * vitals with `visits.create` while it is open, the rest of its own — and
 * its treatments — with `visits.edit`, and only `visits.edit` once it is
 * done (D208) — and the
 * prescription for its doctor or `prescriptions.write`, open or done (D215);
 * none for an archived patient (D103) or a view-only clinic, which is said.
 * From a tablet, the notes, the treatments and the prescription stand beside
 * the vitals and the follow-up (D209, D263).
 */
function Records({ visit }: { visit: Visit }) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const may = (permission: Parameters<typeof hasAccess>[1]) => membership !== null && hasAccess(membership, permission);
  const vitalsBy = visit.status === "COMPLETED" ? "visits.edit" : "visits.create";
  const writable = !readOnly && !visit.patient.archived;
  // The visit's doctor writes their own prescription; anyone else types it with prescriptions.write (D45, D215).
  const prescribes = membership?.doctorId === visit.doctorId || may("prescriptions.write");
  return (
    <div className="grid gap-6">
      {(may(vitalsBy) || may("visits.edit") || prescribes) && <ReadOnlyNote />}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 md:grid-rows-[auto_auto_1fr]">
        <VitalsSection visit={visit} writes={writable && may(vitalsBy)} className="md:col-start-1 md:row-start-1" />
        <div className="grid min-w-0 gap-6 md:col-start-2 md:row-span-3 md:row-start-1">
          <NotesSection visit={visit} writes={writable && may("visits.edit")} />
          <TreatmentsSection visit={visit} writes={writable && may("visits.edit")} />
          <PrescriptionSection visit={visit} writes={writable && prescribes} />
        </div>
        <FollowUpSection
          visit={visit}
          writes={writable && may("visits.edit")}
          books={writable && may("appointments.create")}
          className="md:col-start-1 md:row-start-2"
        />
        <div className="md:col-start-1 md:row-start-3">
          <DetailList details={detailsOf(visit)} />
        </div>
      </div>
      {/* Bill now, at the foot of the visit (plan §12.2 item 7, D307). */}
      <div className="flex flex-wrap gap-2 empty:hidden">
        <NewBillLink
          target={{ visit: visit.id }}
          patient={{ name: visit.patient.name, archived: visit.patient.archived }}
          look="visit"
        />
      </div>
    </div>
  );
}

/** The patient in, in the lake (plan §32.1): their token, since when and for how long, and **Done** and **Next patient** (D193). */
function InRoom({ visit, appointment: inRoom }: { visit: Visit; appointment: NonNullable<Visit["appointment"]> }) {
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
  // In progress, the patient has gone in: Send in set when.
  const since = visit.startedAt!;
  return (
    <Lake
      label={`${queue.withDoctor}: ${visit.patient.name}`}
      lead={inRoom.token ? tokenNumeral(inRoom.token) : undefined}
      leadLabel={queue.token}
      title={words.since(formatTime(since))}
      detail={queue.minutes(minutesSince(since, now))}
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

/** A visit started from the profile, open (D204): the lake with since when, and **Done** for `visits.create`. */
function StartedHere({ visit }: { visit: Visit }) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const now = useNow(QUEUE_REFRESH_MS);
  const { finish, finishing } = useFinishVisit(visit);
  const creates = membership !== null && hasAccess(membership, "visits.create");
  // Started from the profile, it went in as it opened.
  const since = visit.startedAt!;
  return (
    <Lake
      label={`${words.title}: ${visit.patient.name}`}
      title={words.since(formatTime(since))}
      detail={queue.minutes(minutesSince(since, now))}
    >
      {creates && !readOnly && (
        <Button
          label={queue.done}
          aria-label={queue.doneOf(visit.patient.name)}
          size="sm"
          loading={finishing}
          onClick={() => void finish()}
        />
      )}
    </Lake>
  );
}
