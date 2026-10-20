"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { HandHeart } from "lucide-react";
import { Controller, useForm, type Resolver } from "react-hook-form";

import { ChoiceChips } from "@/components/ui/choice-chips";
import { FormSheet } from "@/components/ui/form-sheet";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { NO_CHARGE_REASON_LABELS, NO_CHARGE_REASONS } from "@/constants/statuses";
import { FORM_RESET_OPTIONS, noChargeSchema, type NoChargeInput } from "@/lib/validation";

import { useNoCharge } from "../hooks/useNoCharge";

const { billing: words } = UI_TEXT;
const REASON_OPTIONS = NO_CHARGE_REASONS.map((reason) => ({ value: reason, label: NO_CHARGE_REASON_LABELS[reason] }));

/**
 * No charge (plan §15.6; D319): why a visit waiting in To bill is free — a
 * review, a courtesy, or Other with a note. No asking first: a bill may
 * still be issued for it (D287). Closing it goes back to where it was
 * opened; marked, everything closes with a card.
 */
export function NoChargeSheet({
  visit,
  open,
  onClose,
  onDone,
}: {
  visit: { id: string; patient: { id: string; name: string } };
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const marking = useNoCharge(visit, onDone);
  const {
    register,
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<NoChargeInput>({
    resolver: zodResolver(noChargeSchema) as unknown as Resolver<NoChargeInput>,
    defaultValues: { reason: "REVIEW", note: "" },
    resetOptions: FORM_RESET_OPTIONS,
  });

  return (
    <FormSheet
      open={open}
      title={words.noCharge}
      onClose={onClose}
      onSubmit={handleSubmit(() => marking.mark(getValues()))}
      submitting={marking.submitting}
      submitLabel={words.markNoCharge}
      submitIcon={HandHeart}
    >
      <p className="text-body font-bold text-ink">{words.visitOf(visit.patient.name)}</p>
      <Controller
        control={control}
        name="reason"
        render={({ field }) => (
          <ChoiceChips
            label={words.noChargeReasonLabel}
            value={field.value}
            options={REASON_OPTIONS}
            onChange={field.onChange}
            wrap
          />
        )}
      />
      <TextField
        label={words.noChargeNoteLabel}
        hint={words.noChargeNoteHint}
        autoComplete="off"
        maxLength={TEXT_LIMITS.reason}
        error={errors.note?.message}
        {...register("note")}
      />
    </FormSheet>
  );
}
