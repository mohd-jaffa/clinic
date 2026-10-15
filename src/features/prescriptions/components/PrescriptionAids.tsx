"use client";

import { ClipboardList, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadFailed } from "@/components/ui/list-screen";
import { Row, RowList } from "@/components/ui/row";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import type { Visit } from "@/features/visits/types";
import { formatNearDate } from "@/lib/format/date";

import { templateLine } from "../content";
import { useTemplates } from "../hooks/useTemplates";
import type { PrescriptionItem, PrescriptionTemplate } from "../types";

const { prescription: words, documents } = UI_TEXT;

/** What Repeat or a template adds (D237, D238): its medicines and advice, and where they came from. */
export interface Addition {
  items: readonly PrescriptionItem[];
  advice: string | null;
  from: string;
}

/**
 * **Repeat** and **Templates** above the medicines (D239): Repeat names the
 * day and doctor of the patient's prescription before this visit and adds
 * it in one tap (D236) — not there when there is none; Templates opens the
 * visit doctor's templates, one tap adding one (D241). Both add after what
 * is typed (D237).
 */
export function PrescriptionAids({
  visit,
  own,
  onAdd,
}: {
  visit: Visit;
  /** Whether the visit is the member's own: their templates, not the doctor's by name. */
  own: boolean;
  onAdd: (addition: Addition) => void;
}) {
  const [sheet, setSheet] = useState({ open: false, opened: false });
  const previous = visit.previousPrescription;
  const doctor = visit.doctorName ?? UI_TEXT.appointment.formerDoctor;
  const close = () => setSheet((now) => ({ ...now, open: false }));

  return (
    <div className="flex flex-wrap gap-2">
      {previous && (
        <RepeatButton
          day={previous.day}
          doctor={previous.doctorName}
          onRepeat={(from) => onAdd({ items: previous.items, advice: previous.advice, from })}
        />
      )}
      <Button
        label={words.templates}
        icon={ClipboardList}
        variant="secondary"
        size="sm"
        onClick={() => setSheet({ open: true, opened: true })}
      />
      <TemplatesSheet
        open={sheet.open}
        onClose={close}
        doctorId={sheet.opened ? visit.doctorId : null}
        title={own ? words.templates : words.templatesOf(doctor)}
        emptyHint={own ? words.noTemplatesHint : words.noTemplatesFor(doctor)}
        onPick={(template) => {
          close();
          onAdd({ items: template.items, advice: template.advice, from: words.quoted(template.name) });
        }}
      />
    </div>
  );
}

/** "Repeat 12 Oct · Dr. Maya Rao" (D236). */
function RepeatButton({
  day,
  doctor,
  onRepeat,
}: {
  day: string;
  doctor: string | null;
  onRepeat: (from: string) => void;
}) {
  const when = formatNearDate(day);
  const who = doctor === null ? UI_TEXT.appointment.formerDoctor : documents.doctor(doctor);
  return (
    <Button
      label={words.repeat(when, who)}
      icon={RotateCcw}
      variant="secondary"
      size="sm"
      onClick={() => onRepeat(words.repeatedFrom(when, who))}
    />
  );
}

/**
 * The doctor's templates in use, by name, each with its medicines under it
 * (D241); one tap takes it. Read once the sheet is first opened.
 */
function TemplatesSheet({
  open,
  onClose,
  doctorId,
  title,
  emptyHint,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  /** None until the sheet is first opened. */
  doctorId: string | null;
  title: string;
  emptyHint: string;
  onPick: (template: PrescriptionTemplate) => void;
}) {
  const query = useTemplates(doctorId);
  const offered = query.data?.filter((template) => template.active);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {offered === undefined ? (
        query.error != null ? (
          <LoadFailed query={query} loadFailed="TEMPLATES_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={3} />
          </section>
        )
      ) : offered.length === 0 ? (
        <EmptyState icon={ClipboardList} title={words.noTemplates} hint={emptyHint} />
      ) : (
        <RowList look="menu" label={title}>
          {offered.map((template) => (
            <Row
              key={template.id}
              look="menu"
              title={template.name}
              subtitle={templateLine(template.items)}
              onClick={() => onPick(template)}
            />
          ))}
        </RowList>
      )}
    </Sheet>
  );
}
