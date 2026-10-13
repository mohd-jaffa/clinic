"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import type { Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useResponse } from "@/components/ui/response-card";
import { TextAreaField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { useRevalidate } from "@/lib/query/useRevalidate";
import { visitNotesSchema, type VisitNotesInput } from "@/lib/validation";

import { VisitsClient } from "../api.client";
import { useVisitSection } from "../hooks/useVisitSection";
import type { Visit, VisitNotes } from "../types";
import { ChangedMeanwhile } from "./ChangedMeanwhile";

const { visit: words } = UI_TEXT;

/** The section as the screen holds it, in a fixed order. */
const notesOf = ({ complaint, diagnosis, notes }: VisitNotes): VisitNotes => ({ complaint, diagnosis, notes });

/** Its fields for a copy of it: blank for none. */
const notesInput = (saved: VisitNotes): VisitNotesInput => ({
  complaint: saved.complaint ?? "",
  diagnosis: saved.diagnosis ?? "",
  notes: saved.notes ?? "",
});

/** What was written, each under its name; "Nothing recorded" until anything is. */
function NotesReadout({ notes }: { notes: VisitNotes }) {
  const lines = [
    { label: words.complaintLabel, value: notes.complaint },
    { label: words.diagnosisLabel, value: notes.diagnosis },
    { label: words.notesLabel, value: notes.notes },
  ].flatMap(({ label, value }) => (value ? [{ label, value }] : []));
  if (lines.length === 0) return <p className="text-small text-muted">{words.nothingRecorded}</p>;
  return (
    <dl className="grid gap-4">
      {lines.map(({ label, value }) => (
        <div key={label} className="grid gap-0.5">
          <dt className="text-small font-bold text-muted">{label}</dt>
          <dd className="break-words whitespace-pre-line text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Complaint, diagnosis and notes (plan §12.2; D202): the fields on the
 * screen for `visits.edit` — the doctor, or an assistant typing for them
 * (D45) — saved alone with **Save notes**, shown once something is typed;
 * read out for whoever may only read.
 */
export function NotesSection({ visit, writes, className }: { visit: Visit; writes: boolean; className?: string }) {
  if (!writes) {
    return (
      <Panel title={words.notesTitle} className={className}>
        <NotesReadout notes={notesOf(visit)} />
      </Panel>
    );
  }
  return <NotesForm visit={visit} className={className} />;
}

function NotesForm({ visit, className }: { visit: Visit; className?: string }) {
  const respond = useResponse();
  const refresh = useRevalidate();
  const formId = useId();
  const route = apiRoutes.visits.one(visit.id);
  const section = useVisitSection({
    saved: notesOf(visit),
    toInput: notesInput,
    resolver: zodResolver(visitNotesSchema) as unknown as Resolver<VisitNotesInput>,
  });
  const {
    register,
    formState: { errors },
  } = section.form;
  const saving = useApiMutation(
    async (input: VisitNotesInput) => {
      const result = await VisitsClient.change({
        id: visit.id,
        input: { section: "NOTES", changes: input, seen: section.seen },
      });
      section.saved(notesOf(result as VisitNotes));
      return result;
    },
    {
      revalidate: [route],
      onSuccess: () => respond.success({ title: words.notesSaved }),
      onError: (failure) => {
        // Someone saved them meanwhile: theirs is read, to show beside what is typed.
        if (failure instanceof ApiError && failure.code === "VISIT_CHANGED") void refresh([route]);
        respond.failure(failure, { title: words.notSaved });
      },
    },
  );

  return (
    <Panel
      title={words.notesTitle}
      className={className}
      footer={
        section.dirty && (
          <Button type="submit" form={formId} label={words.saveNotes} size="sm" loading={saving.submitting} />
        )
      }
    >
      <form
        id={formId}
        noValidate
        className="grid gap-4"
        // What was typed is sent, to be read once more by the route.
        onSubmit={section.form.handleSubmit(() => saving.submit(section.form.getValues()))}
      >
        <TextAreaField
          label={words.complaintLabel}
          rows={2}
          autoComplete="off"
          maxLength={TEXT_LIMITS.complaint}
          error={errors.complaint?.message}
          {...register("complaint")}
        />
        <TextAreaField
          label={words.diagnosisLabel}
          rows={2}
          autoComplete="off"
          maxLength={TEXT_LIMITS.diagnosis}
          error={errors.diagnosis?.message}
          {...register("diagnosis")}
        />
        <TextAreaField
          label={words.notesLabel}
          rows={6}
          autoComplete="off"
          maxLength={TEXT_LIMITS.clinicalNotes}
          error={errors.notes?.message}
          {...register("notes")}
        />
      </form>
      {section.theirs !== undefined && (
        <ChangedMeanwhile onTake={section.takeTheirs}>
          <NotesReadout notes={section.theirs} />
        </ChangedMeanwhile>
      )}
    </Panel>
  );
}
