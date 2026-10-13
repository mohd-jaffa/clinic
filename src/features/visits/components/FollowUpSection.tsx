"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Controller, useWatch, type Resolver } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { DateField } from "@/components/ui/date-field";
import { Panel } from "@/components/ui/panel";
import { useResponse } from "@/components/ui/response-card";
import { FOLLOW_UP_CHOICES, type FollowUpChoice } from "@/constants/clinical";
import { UI_TEXT } from "@/constants/messages";
import { BookingSheet } from "@/features/appointments/components/BookingSheet";
import { ApiError } from "@/lib/api/client";
import { addDaysKey, addMonthsKey, todayKey } from "@/lib/dates/calendar";
import { formatLongDate } from "@/lib/format/date";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { useRevalidate } from "@/lib/query/useRevalidate";
import { followUpFormSchema, type FollowUpInput } from "@/lib/validation";

import { VisitsClient } from "../api.client";
import { useVisitSection } from "../hooks/useVisitSection";
import type { Visit } from "../types";
import { ChangedMeanwhile } from "./ChangedMeanwhile";

const { visit: words } = UI_TEXT;

type FollowUp = { followUpOn: string | null };

/** The review day as read out: "Review on Tuesday, 20 Oct 2026", or none. */
const FollowUpReadout = ({ followUp }: { followUp: FollowUp }) => (
  <p className={followUp.followUpOn ? "font-bold text-ink" : "text-small text-muted"}>
    {followUp.followUpOn ? words.followUpSaved(formatLongDate(followUp.followUpOn)) : words.noFollowUp}
  </p>
);

/**
 * The follow-up (plan §12.2; D205): when to come back — a chip for 3 days,
 * 1 week, 2 weeks or 1 month after the visit's day, or any later day — saved
 * alone with **Save follow-up** for `visits.edit`, read out for whoever may
 * only read. **Book next appointment** opens the booking with the patient,
 * the doctor and that day filled in, for whoever books.
 */
export function FollowUpSection({
  visit,
  writes,
  books,
  className,
}: {
  visit: Visit;
  writes: boolean;
  /** Whether Book next appointment is offered: `appointments.create`, and the clinic and patient writable. */
  books: boolean;
  className?: string;
}) {
  const [booking, setBooking] = useState({ open: false, count: 0 });
  const book = books && (
    <Button
      label={words.bookNext}
      icon={CalendarPlus}
      variant="secondary"
      size="sm"
      onClick={() => setBooking(({ count }) => ({ open: true, count: count + 1 }))}
    />
  );
  return (
    <>
      {writes ? (
        <FollowUpForm visit={visit} book={book} className={className} />
      ) : (
        <Panel title={words.followUpTitle} className={className} footer={book}>
          <FollowUpReadout followUp={{ followUpOn: visit.followUpOn }} />
        </Panel>
      )}
      {books && (
        <BookingSheet
          key={booking.count}
          patient={{ id: visit.patient.id, name: visit.patient.name, number: visit.patient.number }}
          prefill={{ doctorId: visit.doctorId, date: visit.followUpOn ?? todayKey(), time: { hour: "", minute: "" } }}
          open={booking.open}
          onClose={() => setBooking((now) => ({ ...now, open: false }))}
        />
      )}
    </>
  );
}

function FollowUpForm({ visit, book, className }: { visit: Visit; book: ReactNode; className?: string }) {
  const respond = useResponse();
  const refresh = useRevalidate();
  const formId = useId();
  const route = apiRoutes.visits.one(visit.id);
  const section = useVisitSection<FollowUp, FollowUpInput>({
    saved: { followUpOn: visit.followUpOn },
    toInput: (saved) => ({ followUpOn: saved.followUpOn ?? "" }),
    resolver: zodResolver(followUpFormSchema(visit.day)) as unknown as Resolver<FollowUpInput>,
  });
  const {
    control,
    setValue,
    formState: { errors },
  } = section.form;
  const chosen = useWatch({ control, name: "followUpOn" });
  const choices = FOLLOW_UP_CHOICES.map((choice) => ({
    value: choice.key as FollowUpChoice | "",
    label: words.followUpChoices[choice.key],
    day: "days" in choice ? addDaysKey(visit.day, choice.days) : addMonthsKey(visit.day, choice.months),
  }));
  const saving = useApiMutation(
    async (input: FollowUpInput) => {
      const result = await VisitsClient.change({
        id: visit.id,
        input: { section: "FOLLOW_UP", changes: input, seen: section.seen },
      });
      const saved = { followUpOn: result.followUpOn ?? null };
      section.saved(saved);
      return saved;
    },
    {
      revalidate: [route],
      onSuccess: ({ followUpOn }) =>
        respond.success({
          title: followUpOn ? words.followUpSaved(formatLongDate(followUpOn)) : words.followUpRemoved,
        }),
      onError: (failure) => {
        // Someone saved it meanwhile: theirs is read, to show beside what is chosen.
        if (failure instanceof ApiError && failure.code === "VISIT_CHANGED") void refresh([route]);
        respond.failure(failure, { title: words.notSaved });
      },
    },
  );

  return (
    <Panel
      title={words.followUpTitle}
      className={className}
      footer={
        (section.dirty || book) && (
          <>
            {book}
            {section.dirty && (
              <Button type="submit" form={formId} label={words.saveFollowUp} size="sm" loading={saving.submitting} />
            )}
          </>
        )
      }
    >
      <form
        id={formId}
        noValidate
        className="grid gap-3"
        // What was chosen is sent, to be read once more by the route.
        onSubmit={section.form.handleSubmit(() => saving.submit(section.form.getValues()))}
      >
        <ChoiceChips
          label={words.followUpChoicesLabel}
          value={choices.find((choice) => choice.day === chosen)?.value ?? ""}
          options={choices}
          onChange={(key) =>
            setValue("followUpOn", choices.find((choice) => choice.value === key)!.day, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          wrap
        />
        <Controller
          control={control}
          name="followUpOn"
          render={({ field }) => (
            <DateField
              ref={field.ref}
              label={words.followUpLabel}
              hint={words.followUpHint}
              optional
              clearable
              min={addDaysKey(visit.day, 1)}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.followUpOn?.message}
            />
          )}
        />
      </form>
      {section.theirs !== undefined && (
        <ChangedMeanwhile onTake={section.takeTheirs}>
          <FollowUpReadout followUp={section.theirs} />
        </ChangedMeanwhile>
      )}
    </Panel>
  );
}
