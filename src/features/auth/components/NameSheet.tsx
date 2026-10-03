"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { useResponse } from "@/components/ui/response-card";
import { TextField } from "@/components/ui/text-field";
import { UI_TEXT } from "@/constants/messages";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { profileNameSchema, type ProfileNameInput, type ProfileNamePayload } from "@/lib/validation";

import { AuthClient } from "../api.client";
import { useAuth } from "../AuthProvider";

const { account } = UI_TEXT;

/**
 * My account's name (plan §5.4, D72), in a sheet of its own. Once saved, the
 * session is read again, so the shell and every screen that greets them
 * have the new name, and the sheet keeps it for the next time it opens.
 */
export function NameSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, reload } = useAuth();
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ProfileNameInput, unknown, ProfileNamePayload>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { fullName: profile?.fullName ?? "" },
  });

  const { submit, submitting } = useApiMutation(AuthClient.updateProfile, {
    onSuccess: async (saved) => {
      reset({ fullName: saved.fullName });
      await reload();
      onClose();
      respond.success({ title: account.nameSaved });
    },
    onError: (failure) => respond.failure(failure, { title: account.detailsNotSaved }),
  });

  return (
    <FormSheet
      open={open}
      title={account.changeName}
      onClose={onClose}
      onSubmit={handleSubmit(() => submit(getValues()))}
      submitting={submitting}
    >
      <TextField
        label={account.nameLabel}
        autoComplete="name"
        required
        error={errors.fullName?.message}
        {...register("fullName")}
      />
    </FormSheet>
  );
}
