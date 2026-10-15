"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { cancelTreatmentSchema, FORM_RESET_OPTIONS, type CancelTreatmentInput } from "@/lib/validation";

import { useTreatmentStatus } from "../hooks/useTreatmentStatus";
import type { Treatment } from "../types";

const { treatments: words } = UI_TEXT;

/**
 * Why a treatment is cancelled (D250): a short reason — "Patient declined" —
 * or nothing. Then the coral card asks first (AGENTS.md §23); cancelled,
 * everything closes with a card. Closing this goes back to its sheet.
 */
export function CancelTreatmentSheet({
  treatment,
  visitId,
  open,
  onClose,
  onDone,
}: {
  treatment: Treatment;
  visitId: string | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const status = useTreatmentStatus(treatment, visitId, onDone);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CancelTreatmentInput, unknown, { reason: string | null }>({
    resolver: zodResolver(cancelTreatmentSchema) as Resolver<CancelTreatmentInput, unknown, { reason: string | null }>,
    defaultValues: { reason: "" },
    resetOptions: FORM_RESET_OPTIONS,
  });

  return (
    <FormSheet
      open={open}
      title={words.cancelTitle(treatment.name)}
      onClose={onClose}
      onSubmit={handleSubmit(({ reason }) => void status.cancel(reason))}
      submitting={status.submitting}
      submitLabel={words.cancel}
      submitIcon={Ban}
      submitVariant="danger"
    >
      <TextField
        label={words.reasonLabel}
        hint={words.reasonHint}
        optional
        autoComplete="off"
        maxLength={TEXT_LIMITS.reason}
        error={errors.reason?.message}
        {...register("reason")}
      />
    </FormSheet>
  );
}
