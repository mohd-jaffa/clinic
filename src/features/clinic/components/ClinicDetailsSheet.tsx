"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { useResponse } from "@/components/ui/response-card";
import { optionsFrom, SelectField } from "@/components/ui/select-field";
import { TextAreaField, TextField } from "@/components/ui/text-field";
import { UI_TEXT } from "@/constants/messages";
import { CLINIC_TYPE_LABELS, CLINIC_TYPES } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { clinicDetailsSchema, type ClinicDetailsInput, type ClinicDetailsPayload } from "@/lib/validation";

import { ClinicClient } from "../api.client";
import type { ClinicProfile } from "../types";

const { clinic } = UI_TEXT;

/** What the sheet holds, from the clinic as it is: an empty field for nothing added. */
const formOf = (profile: ClinicProfile): ClinicDetailsInput => ({
  name: profile.name,
  clinicType: profile.clinicType,
  address: profile.address,
  city: profile.city,
  phone: profile.phone ?? "",
  email: profile.email ?? "",
  gstin: profile.gstin ?? "",
});

/**
 * Clinic details (plan §9, D78): name, type, address, city, phone, email and
 * GSTIN in one sheet, saved together. Once saved, the session is read again,
 * so the shell has the new name, and the sheet keeps what was saved.
 */
export function ClinicDetailsSheet({
  open,
  onClose,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  profile: ClinicProfile;
}) {
  const { reload } = useAuth();
  const respond = useResponse();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ClinicDetailsInput, unknown, ClinicDetailsPayload>({
    resolver: zodResolver(clinicDetailsSchema),
    defaultValues: formOf(profile),
  });

  const { submit, submitting } = useApiMutation(ClinicClient.update, {
    revalidate: [apiRoutes.clinic.profile],
    onSuccess: async (saved) => {
      reset(formOf(saved));
      await reload();
      onClose();
      respond.success({ title: clinic.detailsSaved });
    },
    onError: (failure) => respond.failure(failure, { title: clinic.detailsNotSaved }),
  });

  return (
    <FormSheet
      open={open}
      title={clinic.changeDetails}
      onClose={onClose}
      onSubmit={handleSubmit(() => submit({ details: getValues() }))}
      submitting={submitting}
    >
      <TextField
        label={clinic.nameLabel}
        autoComplete="organization"
        required
        error={errors.name?.message}
        {...register("name")}
      />
      <Controller
        control={control}
        name="clinicType"
        render={({ field }) => (
          <SelectField
            ref={field.ref}
            label={clinic.typeLabel}
            options={optionsFrom(CLINIC_TYPES, CLINIC_TYPE_LABELS)}
            required
            error={errors.clinicType?.message}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
        )}
      />
      <TextAreaField
        label={clinic.addressLabel}
        autoComplete="street-address"
        required
        error={errors.address?.message}
        {...register("address")}
      />
      <TextField
        label={clinic.cityLabel}
        autoComplete="address-level2"
        required
        error={errors.city?.message}
        {...register("city")}
      />
      <TextField
        label={clinic.phoneLabel}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        optional
        error={errors.phone?.message}
        {...register("phone")}
      />
      <TextField
        label={clinic.emailLabel}
        type="email"
        inputMode="email"
        autoComplete="email"
        optional
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label={clinic.gstinLabel}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        optional
        error={errors.gstin?.message}
        {...register("gstin")}
      />
    </FormSheet>
  );
}
