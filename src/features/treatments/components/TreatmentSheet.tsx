"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, CheckCheck, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useId, useRef } from "react";
import { Controller, useWatch, type Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { DateField } from "@/components/ui/date-field";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { Row, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { TextAreaField } from "@/components/ui/text-field";
import { FOLLOW_UP_CHOICES, type FollowUpChoice } from "@/constants/clinical";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { VISIT_FROM, visitRoute } from "@/constants/navigation";
import { TREATMENT_STATUS_LABELS, TREATMENT_STATUS_TONES } from "@/constants/statuses";
import { ChangedMeanwhile } from "@/features/visits/components/ChangedMeanwhile";
import { useVisitSection } from "@/features/visits/hooks/useVisitSection";
import { addDaysKey, addMonthsKey, todayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { formatDate, formatLongDate } from "@/lib/format/date";
import { nextDueFormSchema, sessionFormSchema, type NextDueInput, type SessionFormInput } from "@/lib/validation";

import { isOpen } from "../api";
import { movesFrom, type StatusMove } from "../describe";
import { useTreatmentChange } from "../hooks/useTreatmentChange";
import { useTreatmentSession } from "../hooks/useTreatmentSession";
import { useTreatmentStatus } from "../hooks/useTreatmentStatus";
import type { Treatment } from "../types";

const { treatments: words, appointment, visit: visitWords } = UI_TEXT;

/** The visit a treatment was opened from: which, and whether it is still open (D254). */
export interface TreatmentVisit {
  id: string;
  open: boolean;
}

/** What its sheet says of a treatment (D261), each line only when it holds something. */
function detailsOf(treatment: Treatment, dueShown: boolean): Detail[] {
  const lines: [string, string | null][] = [
    [words.doctorLabel, treatment.doctorName ?? appointment.formerDoctor],
    [words.startedLabel, treatment.startedOn && formatLongDate(treatment.startedOn)],
    [words.completedLabel, treatment.completedOn && formatLongDate(treatment.completedOn)],
    [words.cancelledLabel, treatment.cancelledOn && formatLongDate(treatment.cancelledOn)],
    [words.reasonLabel, treatment.cancelReason],
    [words.nextDueLabel, dueShown && treatment.nextDueOn ? formatLongDate(treatment.nextDueOn) : null],
    [words.estimateLabel, treatment.estimatedCostPaise === null ? null : formatPaise(treatment.estimatedCostPaise)],
    [words.descriptionLabel, treatment.description],
  ];
  return lines.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/** Each move's words and mark: the one carrying it forward leads, Put on hold follows. */
const MOVES: Record<StatusMove, { label: string; icon: typeof Play }> = {
  START: { label: words.start, icon: Play },
  RESUME: { label: words.resume, icon: Play },
  HOLD: { label: words.hold, icon: Pause },
  COMPLETE: { label: words.complete, icon: CheckCheck },
  CANCEL: { label: words.cancel, icon: Ban },
};

/**
 * A treatment opened (plan §14.1; D250, D256 – D261), from a visit's card or
 * the patient's profile: where it stands and its details; on a visit, what
 * this visit did for it — its note, **This completes it**, and **Remove from
 * this visit** while the visit is open (D254); its next sitting; and its
 * sessions, visit by visit, each opening its visit. Under it, for
 * `visits.edit`, what its status allows — **Start**, **Resume**, **Put on
 * hold**, **Complete** — and **Edit** and **Cancel treatment**. Each closes
 * it with a card.
 */
export function TreatmentSheet({
  treatment,
  visit,
  writes,
  open,
  onClose,
  onEdit,
  onCancel,
}: {
  treatment: Treatment;
  visit: TreatmentVisit | null;
  /** `visits.edit`, while the clinic can write and the patient is not archived. */
  writes: boolean;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const status = useTreatmentStatus(treatment, visit?.id ?? null, onClose);
  // Opened, it starts at its top — not in this visit's note, which would raise a phone's keyboard unasked.
  const top = useRef<HTMLDivElement>(null);
  const going = isOpen(treatment.status);
  const moves = writes ? movesFrom(treatment.status).filter((move) => move !== "CANCEL") : [];

  const footer = writes && (
    <div role="group" aria-label={words.actions} className="flex flex-wrap gap-2">
      {moves.map((move) => (
        <Button
          key={move}
          label={MOVES[move].label}
          icon={MOVES[move].icon}
          variant={move === "HOLD" ? "secondary" : "primary"}
          size="sm"
          disabled={status.submitting}
          onClick={() => void status.move(move)}
        />
      ))}
      <Button
        label={words.edit}
        aria-label={words.editOf(treatment.name)}
        icon={Pencil}
        variant="secondary"
        size="sm"
        onClick={onEdit}
      />
      {going && <Button label={words.cancel} icon={Ban} variant="danger" size="sm" onClick={onCancel} />}
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={treatment.name} footer={footer} initialFocus={top}>
      <div className="grid gap-5">
        <div ref={top} tabIndex={-1} className="outline-none">
          <StatusPill
            label={TREATMENT_STATUS_LABELS[treatment.status]}
            tone={TREATMENT_STATUS_TONES[treatment.status]}
          />
        </div>
        <DetailList details={detailsOf(treatment, !(writes && going))} />
        {visit && <ThisVisit treatment={treatment} visit={visit} writes={writes} onDone={onClose} />}
        {writes && going && <NextDue treatment={treatment} visitId={visit?.id ?? null} onDone={onClose} />}
        <Sessions treatment={treatment} current={visit?.id ?? null} />
      </div>
    </Sheet>
  );
}

/**
 * What this visit did for it (D256, D257): its note, and **This completes
 * it** while it is open — one save. Saved once already, its note is changed
 * from the copy read; **Remove from this visit** while the visit is open
 * (D254). For whoever may only read, the note as written.
 */
function ThisVisit({
  treatment,
  visit,
  writes,
  onDone,
}: {
  treatment: Treatment;
  visit: TreatmentVisit;
  writes: boolean;
  onDone: () => void;
}) {
  const headingId = useId();
  const session = treatment.sessions.find((one) => one.visitId === visit.id);
  const going = isOpen(treatment.status);
  if (!writes || (!going && session === undefined)) {
    if (session === undefined) return null;
    return (
      <section aria-labelledby={headingId} className="grid gap-2">
        <SectionHeading id={headingId} title={words.thisVisitTitle} />
        <p className="break-words whitespace-pre-line text-ink">{session.note ?? words.noNote}</p>
      </section>
    );
  }
  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <SectionHeading id={headingId} title={words.thisVisitTitle} />
      <SessionForm
        treatment={treatment}
        visit={visit}
        recorded={session !== undefined}
        note={session?.note ?? null}
        onDone={onDone}
      />
    </section>
  );
}

type SessionCopy = { recorded: boolean; note: string | null };

function SessionForm({
  treatment,
  visit,
  recorded,
  note,
  onDone,
}: {
  treatment: Treatment;
  visit: TreatmentVisit;
  recorded: boolean;
  note: string | null;
  onDone: () => void;
}) {
  const formId = useId();
  const section = useVisitSection<SessionCopy, SessionFormInput>({
    saved: { recorded, note },
    toInput: (copy) => ({ note: copy.note ?? "", complete: false }),
    resolver: zodResolver(sessionFormSchema) as unknown as Resolver<SessionFormInput>,
  });
  const session = useTreatmentSession(treatment, visit.id, {
    onSaved: (saved) => section.saved({ recorded: true, note: saved.note }),
    onDone,
  });
  const {
    register,
    formState: { errors },
  } = section.form;
  const seen = section.seen.recorded ? { note: section.seen.note } : null;

  return (
    <form
      id={formId}
      noValidate
      className="grid gap-3"
      // What was typed is sent, to be read once more by the route.
      onSubmit={section.form.handleSubmit(() => session.save({ ...section.form.getValues(), seen }))}
    >
      <TextAreaField
        label={words.noteLabel}
        rows={3}
        autoComplete="off"
        maxLength={TEXT_LIMITS.sessionNote}
        error={errors.note?.message}
        {...register("note")}
      />
      {isOpen(treatment.status) && (
        <Checkbox label={words.completes} hint={words.completesHint} {...register("complete")} />
      )}
      {section.theirs !== undefined && (
        <ChangedMeanwhile onTake={section.takeTheirs}>
          <p className="break-words whitespace-pre-line text-ink">{section.theirs.note ?? words.noNote}</p>
        </ChangedMeanwhile>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {recorded && visit.open && (
          <Button
            label={words.removeSession}
            icon={Trash2}
            variant="quiet"
            size="sm"
            loading={session.removing}
            disabled={session.saving}
            onClick={() => void session.remove()}
          />
        )}
        {(!recorded || section.dirty) && (
          <Button type="submit" label={words.saveSession} size="sm" loading={session.saving} />
        )}
      </div>
    </form>
  );
}

type DueCopy = { nextDueOn: string | null };

/**
 * Its next sitting (D259): a chip for 3 days, 1 week, 2 weeks or 1 month from
 * today, or any day from today on — saved alone with **Save next sitting**,
 * from the copy read (D251).
 */
function NextDue({ treatment, visitId, onDone }: { treatment: Treatment; visitId: string | null; onDone: () => void }) {
  const headingId = useId();
  const formId = useId();
  const today = todayKey();
  const section = useVisitSection<DueCopy, NextDueInput>({
    saved: { nextDueOn: treatment.nextDueOn },
    toInput: (copy) => ({ nextDueOn: copy.nextDueOn ?? "" }),
    resolver: zodResolver(nextDueFormSchema(today)) as unknown as Resolver<NextDueInput>,
  });
  const change = useTreatmentChange(treatment, visitId, {
    onSaved: (saved) => section.saved({ nextDueOn: saved.nextDueOn ?? null }),
    onDone,
  });
  const {
    control,
    setValue,
    formState: { errors },
  } = section.form;
  const chosen = useWatch({ control, name: "nextDueOn" });
  const choices = FOLLOW_UP_CHOICES.map((choice) => ({
    value: choice.key as FollowUpChoice | "",
    label: visitWords.followUpChoices[choice.key],
    day: "days" in choice ? addDaysKey(today, choice.days) : addMonthsKey(today, choice.months),
  }));

  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <SectionHeading id={headingId} title={words.nextDueTitle} />
      <form
        id={formId}
        noValidate
        className="grid gap-3"
        onSubmit={section.form.handleSubmit(() =>
          change.save({
            part: "NEXT_DUE",
            changes: section.form.getValues(),
            seen: { nextDueOn: section.seen.nextDueOn },
          }),
        )}
      >
        <ChoiceChips
          label={words.nextDueChoicesLabel}
          value={choices.find((choice) => choice.day === chosen)?.value ?? ""}
          options={choices}
          onChange={(key) =>
            setValue("nextDueOn", choices.find((choice) => choice.value === key)!.day, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          wrap
        />
        <Controller
          control={control}
          name="nextDueOn"
          render={({ field }) => (
            <DateField
              ref={field.ref}
              label={words.nextDueLabel}
              hint={words.nextDueHint}
              optional
              clearable
              min={today}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.nextDueOn?.message}
            />
          )}
        />
        {section.theirs !== undefined && (
          <ChangedMeanwhile onTake={section.takeTheirs}>
            <p className="font-bold text-ink">
              {section.theirs.nextDueOn ? formatLongDate(section.theirs.nextDueOn) : words.noNextDue}
            </p>
          </ChangedMeanwhile>
        )}
        {section.dirty && (
          <div className="flex justify-end">
            <Button type="submit" label={words.saveNextDue} size="sm" loading={change.saving} />
          </div>
        )}
      </form>
    </section>
  );
}

/** Its sessions, visit by visit (D261): the day and doctor, what was done, each opening its visit — but this one. */
function Sessions({ treatment, current }: { treatment: Treatment; current: string | null }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <SectionHeading id={headingId} title={words.sessions} />
      {treatment.sessions.length === 0 ? (
        <p className="text-small text-muted">{words.noSessions}</p>
      ) : (
        <RowList label={words.sessions}>
          {treatment.sessions.map((session) => (
            <Row
              key={session.id}
              look="quiet"
              title={words.sessionOn(formatDate(session.day), session.doctorName ?? appointment.formerDoctor)}
              subtitle={session.note ?? words.noNote}
              wrap
              href={session.visitId === current ? undefined : visitRoute(session.visitId, VISIT_FROM.patient)}
            />
          ))}
        </RowList>
      )}
    </section>
  );
}
