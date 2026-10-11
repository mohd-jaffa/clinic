"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban } from "lucide-react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";

import { ChoiceField } from "@/components/ui/choice-field";
import { FormSheet } from "@/components/ui/form-sheet";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { formatLongDate } from "@/lib/format/date";
import { CANCEL_REASONS, cancelSchema, FORM_RESET_OPTIONS, OTHER_REASON, type CancelInput } from "@/lib/validation";

import { timeOf } from "../describe";
import { useStatusChange } from "../hooks/useStatusChange";
import type { CalendarAppointment } from "../types";

const { appointment: words } = UI_TEXT;
const REASON_OPTIONS = [
  ...CANCEL_REASONS.map((reason) => ({ value: reason, label: reason })),
  { value: OTHER_REASON, label: words.otherReason },
];

/**
 * Why an appointment is cancelled (D162): a quick reason — the patient asked,
 * the doctor is unavailable, the clinic is closed, booked by mistake — or
 * **Other**, typed. Then the coral card asks first (AGENTS.md §23); cancelled,
 * everything closes with a card (D165). Closing this goes back to the detail.
 */
export function CancelSheet({
  appointment,
  open,
  onClose,
  onDone,
}: {
  appointment: CalendarAppointment;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const status = useStatusChange(appointment, onDone);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CancelInput, unknown, { reason: string }>({
    resolver: zodResolver(cancelSchema) as Resolver<CancelInput, unknown, { reason: string }>,
    defaultValues: { choice: "", other: "" },
    resetOptions: FORM_RESET_OPTIONS,
  });
  const choice = useWatch({ control, name: "choice" });

  return (
    <FormSheet
      open={open}
      title={words.cancelTitle}
      onClose={onClose}
      onSubmit={handleSubmit(({ reason }) => status.cancel(reason))}
      submitting={status.submitting}
      submitLabel={words.cancel}
      submitIcon={Ban}
      submitVariant="danger"
    >
      <p className="text-body text-ink">
        <span className="font-bold">{appointment.patientName}</span>
        <span className="block text-small text-muted">
          {words.when(formatLongDate(appointment.day), timeOf(appointment))}
        </span>
      </p>
      <Controller
        control={control}
        name="choice"
        render={({ field }) => (
          <ChoiceField
            label={words.reasonsLabel}
            value={field.value}
            options={REASON_OPTIONS}
            onChange={field.onChange}
            required
            error={errors.choice?.message}
          />
        )}
      />
      {choice === OTHER_REASON && (
        <TextField
          label={words.reasonLabel}
          autoComplete="off"
          maxLength={TEXT_LIMITS.reason}
          required
          error={errors.other?.message}
          {...register("other")}
        />
      )}
    </FormSheet>
  );
}
