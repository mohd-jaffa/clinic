"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, MessageCircle, Phone, UserRound } from "lucide-react";
import { useId, useRef } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";

import { Button, LinkButton } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { ChoiceField } from "@/components/ui/choice-field";
import { DateField } from "@/components/ui/date-field";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { useResponse } from "@/components/ui/response-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { REMIND_ME_CHOICES, TEXT_LIMITS, type RemindMeChoice } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { patientRoute } from "@/constants/navigation";
import { FOLLOW_UP_OUTCOME_LABELS, FOLLOW_UP_OUTCOMES, type FollowUpTab } from "@/constants/statuses";
import { addDaysKey, dayKey, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatLongDate } from "@/lib/format/date";
import { callHref, whatsAppHref } from "@/lib/phone";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { followUpContactFormSchema, FORM_RESET_OPTIONS, type FollowUpContactInput } from "@/lib/validation";

import { FollowUpsClient } from "../api.client";
import { followUpReminderText, followUpWhen } from "../describe";
import { useFollowUpContact } from "../hooks/useFollowUpContact";
import { FOLLOW_UP_ROUTES } from "../keys";
import type { FollowUp } from "../types";

const { followUps: words, treatments, appointment, patients } = UI_TEXT;
const OUTCOME_OPTIONS = FOLLOW_UP_OUTCOMES.map((outcome) => ({
  value: outcome,
  label: FOLLOW_UP_OUTCOME_LABELS[outcome],
}));

/** What its sheet says of a follow-up (D275): what it is for, with whom, its day, and the last contact. */
function detailsOf(followUp: FollowUp, completed: boolean): Detail[] {
  const contact = followUp.lastContact;
  return [
    { label: words.forLabel, value: followUp.title ?? words.visitFollowUp },
    { label: treatments.doctorLabel, value: followUp.doctorName ?? appointment.formerDoctor },
    { label: completed ? treatments.completedLabel : words.dueLabel, value: formatLongDate(followUp.dueOn) },
    ...(completed
      ? []
      : [
          {
            label: words.lastContactLabel,
            value: contact
              ? [
                  words.lastContactBy(
                    FOLLOW_UP_OUTCOME_LABELS[contact.outcome],
                    formatDayMonth(dayKey(contact.at)),
                    contact.by,
                  ),
                  contact.note,
                ]
                  .filter(Boolean)
                  .join("\n")
              : words.notContacted,
          },
        ]),
  ];
}

/**
 * A follow-up opened (plan §14.3; D272 – D277): whose, what it is for, its
 * doctor and day, and the last contact — how it went, when, by whom, its
 * note. Then what reaches them: **Call**; **Remind on WhatsApp**, with the
 * message written (D273); **Book**, the booking filled in (D276); and **Open
 * profile**. Under it, for `appointments.edit` or `visits.edit` while the
 * clinic can write, **Mark contacted**. A treatment on Completed is due no
 * more: only Call and the profile (D277).
 */
export function FollowUpSheet({
  followUp,
  tab,
  clinic,
  notes,
  books,
  open,
  onClose,
  onBook,
}: {
  followUp: FollowUp;
  tab: FollowUpTab;
  /** Who the reminder is from, and the number it gives to call. */
  clinic: { name: string; phone: string | null };
  /** Whether a contact is noted: `appointments.edit` or `visits.edit`, while the clinic can write. */
  notes: boolean;
  /** Whether Book is offered: `appointments.create`, while the clinic can write. */
  books: boolean;
  open: boolean;
  onClose: () => void;
  onBook: () => void;
}) {
  // Opened, it starts at its top — not in the note, which would raise a phone's keyboard unasked.
  const top = useRef<HTMLParagraphElement>(null);
  const completed = tab === "COMPLETED";
  const { patient } = followUp;

  return (
    <Sheet open={open} onClose={onClose} title={patient.name} initialFocus={top}>
      <div className="grid gap-5">
        <p ref={top} tabIndex={-1} className="text-small text-muted outline-none">
          {`${patients.number(patient.number)} · ${followUpWhen(followUp, tab)}`}
        </p>
        <DetailList details={detailsOf(followUp, completed)} />
        <div role="group" aria-label={words.actions} className="flex flex-wrap gap-2">
          <LinkButton
            href={callHref(patient.phone)}
            label={patients.callLabel}
            accessibleName={patients.call(patient.name)}
            icon={Phone}
            size="sm"
          />
          {!completed && <Remind followUp={followUp} clinic={clinic} notes={notes} />}
          {books && !completed && (
            <Button
              label={words.book}
              aria-label={words.bookFor(patient.name)}
              icon={CalendarPlus}
              variant="secondary"
              size="sm"
              onClick={onBook}
            />
          )}
          <LinkButton
            href={patientRoute(patient.id)}
            label={appointment.openProfile}
            accessibleName={appointment.openProfileOf(patient.name)}
            icon={UserRound}
            variant="quiet"
            size="sm"
          />
        </div>
        {notes && !completed && <MarkContacted followUp={followUp} onDone={onClose} />}
      </div>
    </Sheet>
  );
}

/**
 * **Remind on WhatsApp** (plan §22.1; D273): WhatsApp opens on the patient's
 * mobile with the reminder written, for a person to send, and it is noted
 * as a contact — *Reminder sent* — as it opens, by whoever notes contacts.
 * In a view-only clinic it still opens, and nothing is noted.
 */
function Remind({
  followUp,
  clinic,
  notes,
}: {
  followUp: FollowUp;
  clinic: { name: string; phone: string | null };
  notes: boolean;
}) {
  const respond = useResponse();
  const noting = useApiMutation(FollowUpsClient.note, {
    revalidate: FOLLOW_UP_ROUTES,
    onError: (failure) => respond.failure(failure, { title: words.reminderNotNoted }),
  });
  const note = () => {
    if (notes) {
      void noting.submit({ kind: followUp.kind, id: followUp.id, outcome: "REMINDER_SENT", note: "", snoozeUntil: "" });
    }
  };
  return (
    <LinkButton
      href={whatsAppHref(followUp.patient.phone, followUpReminderText(followUp, clinic))}
      label={appointment.remind}
      accessibleName={appointment.remindNamed(followUp.patient.name)}
      icon={MessageCircle}
      variant="secondary"
      size="sm"
      newTab
      onClick={note}
    />
  );
}

/**
 * **Mark contacted** (plan §14.3; D271, D274): how it went, a note, and a day
 * to be reminded on — a chip for tomorrow, 3 days, 1 week or 2 weeks from
 * today, or any later day — which keeps it off the lists and their counts
 * until then.
 */
function MarkContacted({ followUp, onDone }: { followUp: FollowUp; onDone: () => void }) {
  const headingId = useId();
  const today = todayKey();
  const contact = useFollowUpContact(followUp, onDone);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FollowUpContactInput>({
    // The form is held as typed; what is sent is read once more by the route.
    resolver: zodResolver(followUpContactFormSchema(today)) as unknown as Resolver<FollowUpContactInput>,
    defaultValues: {
      kind: followUp.kind,
      id: followUp.id,
      outcome: "" as FollowUpContactInput["outcome"],
      note: "",
      snoozeUntil: "",
    },
    resetOptions: FORM_RESET_OPTIONS,
  });
  const chosen = useWatch({ control, name: "snoozeUntil" });
  const choices = REMIND_ME_CHOICES.map((choice) => ({
    value: choice.key as RemindMeChoice | "",
    label: words.remindMeChoices[choice.key],
    day: addDaysKey(today, choice.days),
  }));

  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <SectionHeading id={headingId} title={words.markTitle} />
      <form noValidate className="grid gap-4" onSubmit={handleSubmit(() => contact.save(getValues()))}>
        <Controller
          control={control}
          name="outcome"
          render={({ field }) => (
            <ChoiceField
              label={words.outcomeLabel}
              required
              value={field.value}
              options={OUTCOME_OPTIONS}
              onChange={field.onChange}
              error={errors.outcome?.message}
            />
          )}
        />
        <TextField
          label={words.noteLabel}
          hint={words.noteHint}
          optional
          autoComplete="off"
          maxLength={TEXT_LIMITS.contactNote}
          error={errors.note?.message}
          {...register("note")}
        />
        <div className="grid gap-2">
          <ChoiceChips
            label={words.remindMeChoicesLabel}
            value={choices.find((choice) => choice.day === chosen)?.value ?? ""}
            options={choices}
            onChange={(key) =>
              setValue("snoozeUntil", choices.find((choice) => choice.value === key)!.day, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            wrap
          />
          <Controller
            control={control}
            name="snoozeUntil"
            render={({ field }) => (
              <DateField
                ref={field.ref}
                label={words.remindMeLabel}
                hint={words.remindMeHint}
                optional
                clearable
                min={addDaysKey(today, 1)}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.snoozeUntil?.message}
              />
            )}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" label={words.save} size="sm" loading={contact.saving} />
        </div>
      </form>
    </section>
  );
}
