"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

import { DateField } from "@/components/ui/date-field";
import { FormSheet } from "@/components/ui/form-sheet";
import { useResponse } from "@/components/ui/response-card";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { useDoctors } from "@/features/team/hooks/useDoctors";
import { todayKey } from "@/lib/dates/calendar";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import {
  closureSchema,
  FORM_RESET_OPTIONS,
  WHOLE_CLINIC,
  type ClosureInput,
  type ClosurePayload,
} from "@/lib/validation";

import { ClosuresClient } from "../api.client";

const { closures } = UI_TEXT;

/** A new one: the whole clinic, no days yet, no reason. */
const BLANK: ClosureInput = { who: WHOLE_CLINIC, startsOn: "", endsOn: "", reason: "" };

/**
 * A new holiday or leave (plan §9, D85): who is away — the whole clinic or
 * one of its doctors — the first and last day, and why. Days before today
 * cannot be picked; choosing the first day fills in the last when it is
 * empty or before it, so a single day is one choice. It is never edited, so
 * the sheet only adds.
 */
export function ClosureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const respond = useResponse();
  const doctors = useDoctors().data ?? [];
  const today = todayKey();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors, isSubmitted },
  } = useForm<ClosureInput, unknown, ClosurePayload>({
    resolver: zodResolver(closureSchema),
    defaultValues: BLANK,
    resetOptions: FORM_RESET_OPTIONS,
  });
  const startsOn = useWatch({ control, name: "startsOn" });

  const { submit, submitting } = useApiMutation(ClosuresClient.add, {
    revalidate: [apiRoutes.closures.list],
    onSuccess: (added) => {
      reset(BLANK);
      onClose();
      respond.success({ title: closures.added(added.reason) });
    },
    onError: (failure) => respond.failure(failure, { title: closures.notSaved }),
  });

  const who = [
    { value: WHOLE_CLINIC, label: closures.wholeClinic },
    ...doctors.map((doctor) => ({ value: doctor.id, label: doctor.name })),
  ];

  return (
    <FormSheet
      open={open}
      title={closures.addTitle}
      onClose={onClose}
      onSubmit={handleSubmit(() => submit(getValues()))}
      submitting={submitting}
    >
      <Controller
        control={control}
        name="who"
        render={({ field }) => (
          <SelectField
            ref={field.ref}
            label={closures.whoLabel}
            options={who}
            required
            error={errors.who?.message}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Controller
          control={control}
          name="startsOn"
          render={({ field }) => (
            <DateField
              ref={field.ref}
              label={closures.firstDayLabel}
              required
              min={today}
              error={errors.startsOn?.message}
              value={field.value}
              onChange={(day) => {
                field.onChange(day);
                const last = getValues("endsOn");
                if (last === "" || last < day) setValue("endsOn", day, { shouldValidate: isSubmitted });
              }}
              onBlur={field.onBlur}
            />
          )}
        />
        <Controller
          control={control}
          name="endsOn"
          render={({ field }) => (
            <DateField
              ref={field.ref}
              label={closures.lastDayLabel}
              hint={closures.datesHint}
              required
              min={startsOn || today}
              error={errors.endsOn?.message}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </div>
      <TextField
        label={closures.reasonLabel}
        hint={closures.reasonHint}
        autoComplete="off"
        maxLength={TEXT_LIMITS.closureReason}
        required
        error={errors.reason?.message}
        {...register("reason")}
      />
    </FormSheet>
  );
}
