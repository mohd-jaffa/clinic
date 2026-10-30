"use client";

import { UserRound } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { Sheet } from "@/components/ui/sheet";
import { UI_TEXT } from "@/constants/messages";
import { patientRoute } from "@/constants/navigation";
import { formatDateTime } from "@/lib/format/date";

import { changeLines, describeActivity, subjectOf } from "../describe";
import type { ActivityEntry } from "../types";

const { activity: words } = UI_TEXT;

/**
 * A row of the activity, opened whole (D389): who did it and when, the
 * patient it is about with Open patient, and everything it changed — each
 * value from and to, clinical text by name alone.
 */
export function ActivitySheet({ entry, onClose }: { entry: ActivityEntry; onClose: () => void }) {
  const subject = subjectOf(entry);
  const details: Detail[] = [
    { label: words.who, value: entry.actorName ?? words.someone },
    { label: words.when, value: formatDateTime(entry.at) },
    ...(subject ? [{ label: words.patientLabel, value: subject }] : []),
    ...changeLines(entry),
  ];
  return (
    <Sheet open onClose={onClose} title={describeActivity(entry)}>
      <div className="grid gap-4">
        <DetailList details={details} />
        {entry.patient && (
          <div>
            <LinkButton
              href={patientRoute(entry.patient.id)}
              label={words.openPatient}
              icon={UserRound}
              variant="secondary"
              size="sm"
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}
