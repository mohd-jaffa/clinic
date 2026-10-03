"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { PhoneField } from "@/components/ui/phone-field";
import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { formatPhoneDigits } from "@/lib/phone";
import { useApiMutation } from "@/lib/query/useApiMutation";
import {
  FORM_RESET_OPTIONS,
  profilePhoneSchema,
  type ProfilePhoneInput,
  type ProfilePhonePayload,
} from "@/lib/validation";

import { AuthClient } from "../api.client";
import { useAuth } from "../AuthProvider";

const { account } = UI_TEXT;

/** A mobile as it is read and typed: "98765 43210", the +91 shown beside it. */
const national = (phone: string | null | undefined) => (phone ? formatPhoneDigits(phone) : "");

/**
 * My account's mobile number (plan §5.4, D72), in a sheet of its own. It
 * signs in (D39), so one another account holds is refused beside the field;
 * once saved, the card says it now signs in.
 */
export function PhoneSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, reload } = useAuth();
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProfilePhoneInput, unknown, ProfilePhonePayload>({
    resolver: zodResolver(profilePhoneSchema),
    defaultValues: { phone: national(profile?.phone) },
    resetOptions: FORM_RESET_OPTIONS,
  });

  const { submit, submitting } = useApiMutation(AuthClient.updateProfile, {
    onSuccess: async (saved) => {
      reset({ phone: national(saved.phone) });
      await reload();
      onClose();
      respond.success({
        title: account.phoneSaved,
        message: account.phoneSavedBody(`${UI_TEXT.fields.phonePrefix} ${national(saved.phone)}`),
      });
    },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === "AUTH_PHONE_ALREADY_EXISTS") {
        setError("phone", { message: account.phoneTaken }, { shouldFocus: true });
        return;
      }
      respond.failure(failure, { title: account.detailsNotSaved });
    },
  });

  return (
    <FormSheet
      open={open}
      title={account.changePhone}
      onClose={onClose}
      onSubmit={handleSubmit(() => submit(getValues()))}
      submitting={submitting}
    >
      <PhoneField
        label={account.phoneLabel}
        hint={UI_TEXT.auth.phoneHint}
        required
        error={errors.phone?.message}
        {...register("phone")}
      />
    </FormSheet>
  );
}
