"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useId } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { ChoiceChips } from "@/components/ui/choice-chips";
import { FormSheet } from "@/components/ui/form-sheet";
import { MoneyField } from "@/components/ui/money-field";
import { useResponse } from "@/components/ui/response-card";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { DEFAULT_PRESET, type Permission } from "@/constants/permissions";
import { CLINIC_ROLE_LABELS, INVITE_ROLES, type InviteRole } from "@/constants/roles";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { FORM_RESET_OPTIONS, inviteSchema, type InviteInput, type InvitePayload } from "@/lib/validation";

import { presetPermissions } from "../access";
import { TeamClient } from "../api.client";
import { AccessPicker } from "./AccessPicker";

const { team } = UI_TEXT;
const ROLES = INVITE_ROLES.map((role) => ({ value: role, label: CLINIC_ROLE_LABELS[role] }));

/** A new invite: staff, starting from the Receptionist preset, as far as the inviter may grant it. */
const blank = (allowed: readonly Permission[]): InviteInput => ({
  fullName: "",
  email: "",
  role: "STAFF",
  jobTitle: "",
  permissions: presetPermissions(DEFAULT_PRESET.STAFF, allowed),
  doctor: { specialization: "", qualifications: "", registrationNumber: "", fee: "" },
});

/**
 * Inviting someone (plan §8.4, D89): one sheet in sections — who, by name
 * and email; their role, with a job title for staff; what they may do; and
 * a doctor's details for a doctor. Choosing a role starts its preset over.
 * The link goes only by email (D90): when it could not go, the invite is
 * still made and the card says to Resend it.
 */
export function InviteSheet({
  open,
  onClose,
  allowed,
}: {
  open: boolean;
  onClose: () => void;
  /** What the person inviting may grant (plan §8.2 rule 5). */
  allowed: readonly Permission[];
}) {
  const respond = useResponse();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InviteInput, unknown, InvitePayload>({
    resolver: zodResolver(inviteSchema),
    defaultValues: blank(allowed),
    resetOptions: FORM_RESET_OPTIONS,
  });
  const role = useWatch({ control, name: "role" });
  const doctorTitleId = useId();

  const { submit, submitting } = useApiMutation(TeamClient.invite, {
    revalidate: [apiRoutes.team.list],
    onSuccess: ({ member, emailSent }) => {
      reset(blank(allowed));
      onClose();
      if (emailSent) respond.success({ title: team.invited(member.email) });
      // The email failed, though the invite stands: said as the failure it is, closed when read.
      else respond.error({ title: team.invitedNoEmail, message: team.invitedNoEmailBody });
    },
    onError: (failure) => respond.failure(failure, { title: team.notInvited }),
  });

  return (
    <FormSheet
      open={open}
      title={team.inviteTitle}
      onClose={onClose}
      // A copy: the doctor's details are an object the form goes on changing in place.
      onSubmit={handleSubmit(() => submit(structuredClone(getValues())))}
      submitting={submitting}
      submitLabel={team.send}
      submitIcon={Send}
    >
      <TextField
        label={team.nameLabel}
        autoComplete="off"
        maxLength={TEXT_LIMITS.personName}
        required
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <TextField
        label={team.emailLabel}
        type="email"
        inputMode="email"
        autoComplete="off"
        maxLength={TEXT_LIMITS.email}
        hint={team.emailHint}
        required
        error={errors.email?.message}
        {...register("email")}
      />
      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <div>
            <p className="mb-2 text-small font-bold text-ink">{team.roleLabel}</p>
            <ChoiceChips
              label={team.roleLabel}
              value={field.value as InviteRole}
              options={ROLES}
              onChange={(next) => {
                field.onChange(next);
                setValue("permissions", presetPermissions(DEFAULT_PRESET[next], allowed));
              }}
              wrap
            />
          </div>
        )}
      />
      {role === "STAFF" && (
        <TextField
          label={team.jobTitleLabel}
          hint={team.jobTitleHint}
          autoComplete="off"
          maxLength={TEXT_LIMITS.jobTitle}
          optional
          error={errors.jobTitle?.message}
          {...register("jobTitle")}
        />
      )}
      <Controller
        control={control}
        name="permissions"
        render={({ field }) => (
          <AccessPicker
            value={field.value}
            onChange={field.onChange}
            allowed={allowed}
            error={errors.permissions?.message}
          />
        )}
      />
      {role === "DOCTOR" && (
        <section aria-labelledby={doctorTitleId} className="grid gap-5 border-t border-line pt-5">
          <h3 id={doctorTitleId} className="text-title font-bold text-ink">
            {team.doctorTitle}
          </h3>
          <TextField
            label={team.specializationLabel}
            autoComplete="off"
            maxLength={TEXT_LIMITS.doctorDetail}
            optional
            error={errors.doctor?.specialization?.message}
            {...register("doctor.specialization")}
          />
          <TextField
            label={team.qualificationsLabel}
            hint={team.qualificationsHint}
            autoComplete="off"
            maxLength={TEXT_LIMITS.doctorDetail}
            optional
            error={errors.doctor?.qualifications?.message}
            {...register("doctor.qualifications")}
          />
          <TextField
            label={team.registrationLabel}
            hint={team.registrationHint}
            autoComplete="off"
            maxLength={TEXT_LIMITS.registrationNumber}
            optional
            error={errors.doctor?.registrationNumber?.message}
            {...register("doctor.registrationNumber")}
          />
          <MoneyField
            label={team.feeLabel}
            hint={team.feeHint}
            optional
            error={errors.doctor?.fee?.message}
            {...register("doctor.fee")}
          />
        </section>
      )}
    </FormSheet>
  );
}
