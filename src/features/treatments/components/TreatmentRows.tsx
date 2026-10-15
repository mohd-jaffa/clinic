"use client";

import { Row, RowList } from "@/components/ui/row";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { TREATMENT_STATUS_LABELS, TREATMENT_STATUS_TONES } from "@/constants/statuses";
import { formatNearDate } from "@/lib/format/date";
import { formatPaise } from "@/lib/format/currency";

import { isOpen } from "../api";
import { dueLabel } from "../describe";
import type { Treatment } from "../types";

const { treatments: words, appointment } = UI_TEXT;

/**
 * Where a treatment stands in a line (D256, D260): its doctor; for an open
 * one, when it is next due ("Overdue by 4 days"), else when it closed; and
 * its estimate.
 */
function lineOf(treatment: Treatment): string {
  let when: string | null = null;
  if (isOpen(treatment.status)) when = treatment.nextDueOn && dueLabel(treatment.nextDueOn);
  else if (treatment.completedOn) when = words.completedOn(formatNearDate(treatment.completedOn));
  else if (treatment.cancelledOn) when = words.cancelledOn(formatNearDate(treatment.cancelledOn));
  return [
    treatment.doctorName ?? appointment.formerDoctor,
    when,
    treatment.estimatedCostPaise !== null && words.estimate(formatPaise(treatment.estimatedCostPaise)),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** On a visit's card, what this visit did for it (D256): its session's note, or that it began here. */
function visitNote(treatment: Treatment, visitId: string | null): string | null {
  if (visitId === null) return null;
  const session = treatment.sessions.find((one) => one.visitId === visitId);
  if (session) return words.thisVisit(session.note);
  return treatment.startedVisitId === visitId ? words.startedThisVisit : null;
}

/**
 * Treatments as rows (D256, D260): the name, the line above, what this visit
 * did for it on a visit's card, and the status — each opening its sheet.
 * Closed ones are drawn quiet.
 */
export function TreatmentRows({
  label,
  treatments,
  visitId = null,
  onOpen,
}: {
  label: string;
  treatments: readonly Treatment[];
  visitId?: string | null;
  onOpen: (treatment: Treatment) => void;
}) {
  return (
    <RowList label={label}>
      {treatments.map((treatment) => (
        <Row
          key={treatment.id}
          look={isOpen(treatment.status) ? "surface" : "quiet"}
          title={treatment.name}
          subtitle={lineOf(treatment)}
          note={visitNote(treatment, visitId)}
          detail={
            <StatusPill
              label={TREATMENT_STATUS_LABELS[treatment.status]}
              tone={TREATMENT_STATUS_TONES[treatment.status]}
            />
          }
          onClick={() => onOpen(treatment)}
        />
      ))}
    </RowList>
  );
}
