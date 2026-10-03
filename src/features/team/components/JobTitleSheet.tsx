"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { useResponse } from "@/components/ui/response-card";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { FORM_RESET_OPTIONS, jobTitleSchema, type JobTitleInput, type JobTitlePayload } from "@/lib/validation";

import { TeamClient } from "../api.client";
import type { MemberDetail } from "../types";

const { team, member: words } = UI_TEXT;

/** A member of staff's job title (plan §8.4) — "Front desk", "Nurse" — or none. */
export function JobTitleSheet({ open, onClose, member }: { open: boolean; onClose: () => void; member: MemberDetail }) {
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<JobTitleInput, unknown, JobTitlePayload>({
    resolver: zodResolver(jobTitleSchema),
    defaultValues: { jobTitle: member.jobTitle ?? "" },
    resetOptions: FORM_RESET_OPTIONS,
  });

  const { submit, submitting } = useApiMutation(TeamClient.update, {
    revalidate: [apiRoutes.team.member(member.id), apiRoutes.team.list],
    onSuccess: (saved) => {
      reset({ jobTitle: saved.jobTitle ?? "" });
      onClose();
      respond.success({ title: words.detailsSaved });
    },
    onError: (failure) => respond.failure(failure, { title: words.notSaved }),
  });

  return (
    <FormSheet
      open={open}
      title={words.jobTitleSheet}
      onClose={onClose}
      onSubmit={handleSubmit(() => submit({ id: member.id, jobTitle: getValues("jobTitle") }))}
      submitting={submitting}
    >
      <TextField
        label={team.jobTitleLabel}
        hint={team.jobTitleHint}
        autoComplete="off"
        maxLength={TEXT_LIMITS.jobTitle}
        optional
        error={errors.jobTitle?.message}
        {...register("jobTitle")}
      />
    </FormSheet>
  );
}
