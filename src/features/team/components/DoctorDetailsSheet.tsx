"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { MoneyField } from "@/components/ui/money-field";
import { useResponse } from "@/components/ui/response-card";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { paiseToText } from "@/lib/money";
import { useApiMutation } from "@/lib/query/useApiMutation";
import {
  doctorDetailsSchema,
  FORM_RESET_OPTIONS,
  type DoctorDetailsInput,
  type DoctorDetailsPayload,
} from "@/lib/validation";

import type { DoctorDetails } from "../types";

const { team, member } = UI_TEXT;

/** What the sheet holds: the details as they are, empty for what is not set. */
const formOf = (details: DoctorDetails | null): DoctorDetailsInput => ({
  specialization: details?.specialization ?? "",
  qualifications: details?.qualifications ?? "",
  registrationNumber: details?.registrationNumber ?? "",
  fee: details?.feePaise == null ? "" : paiseToText(details.feePaise),
});

/**
 * A doctor's details (plan §8.4, §3.1): specialization, qualifications, the
 * registration number a prescription needs, and their own consultation fee
 * — left empty, the price list's (D26). It saves through whatever `save` is
 * given: a member's page, or the owner's own profile.
 */
export function DoctorDetailsSheet({
  open,
  onClose,
  details,
  save,
  revalidate,
}: {
  open: boolean;
  onClose: () => void;
  details: DoctorDetails | null;
  /** Sends the details as typed; answers with them as saved. */
  save: (input: DoctorDetailsInput) => Promise<{ doctor: DoctorDetails | null }>;
  /** The routes read again after a save. */
  revalidate: string[];
}) {
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<DoctorDetailsInput, unknown, DoctorDetailsPayload>({
    resolver: zodResolver(doctorDetailsSchema),
    defaultValues: formOf(details),
    resetOptions: FORM_RESET_OPTIONS,
  });

  const { submit, submitting } = useApiMutation(save, {
    revalidate,
    onSuccess: (saved) => {
      reset(formOf(saved.doctor));
      onClose();
      respond.success({ title: member.detailsSaved });
    },
    onError: (failure) => respond.failure(failure, { title: member.notSaved }),
  });

  return (
    <FormSheet
      open={open}
      title={member.doctorSheet}
      onClose={onClose}
      onSubmit={handleSubmit(() => submit(getValues()))}
      submitting={submitting}
    >
      <TextField
        label={team.specializationLabel}
        autoComplete="off"
        maxLength={TEXT_LIMITS.doctorDetail}
        optional
        error={errors.specialization?.message}
        {...register("specialization")}
      />
      <TextField
        label={team.qualificationsLabel}
        hint={team.qualificationsHint}
        autoComplete="off"
        maxLength={TEXT_LIMITS.doctorDetail}
        optional
        error={errors.qualifications?.message}
        {...register("qualifications")}
      />
      <TextField
        label={team.registrationLabel}
        hint={team.registrationHint}
        autoComplete="off"
        maxLength={TEXT_LIMITS.registrationNumber}
        optional
        error={errors.registrationNumber?.message}
        {...register("registrationNumber")}
      />
      <MoneyField label={team.feeLabel} hint={team.feeHint} optional error={errors.fee?.message} {...register("fee")} />
    </FormSheet>
  );
}
