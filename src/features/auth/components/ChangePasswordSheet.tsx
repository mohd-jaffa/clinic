"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/ui/form-sheet";
import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { ApiError } from "@/lib/api/client";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { changePasswordSchema, type ChangePasswordInput, type ChangePasswordPayload } from "@/lib/validation";

import { AuthClient } from "../api.client";
import { useAuth } from "../AuthProvider";
import { PasswordField } from "./PasswordField";

const { account, auth } = UI_TEXT;
const EMPTY: ChangePasswordInput = { currentPassword: "", newPassword: "" };

/**
 * My account's Change password (plan §5.4, D72): the current one first — a
 * session left open on a front-desk computer must not be enough to take the
 * account — then the new, both sent exactly as typed. A wrong current one is
 * said beside it. This device stays signed in; the others are signed out,
 * and the card says so. Allowed in a read-only clinic (plan §7.2).
 */
export function ChangePasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordInput, unknown, ChangePasswordPayload>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  const { submit, submitting } = useApiMutation(AuthClient.changePassword, {
    onSuccess: () => {
      reset(EMPTY);
      onClose();
      respond.success({ title: account.passwordChanged, message: account.passwordChangedBody, autoClose: false });
    },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === "AUTH_PASSWORD_INCORRECT") {
        setError("currentPassword", { message: failure.message }, { shouldFocus: true });
        return;
      }
      respond.failure(failure, { title: account.passwordNotChanged });
    },
  });

  return (
    <FormSheet
      open={open}
      title={account.changePassword}
      onClose={onClose}
      onSubmit={handleSubmit(() => submit(getValues()))}
      submitLabel={account.changePassword}
      submitIcon={KeyRound}
      submitting={submitting}
    >
      {/* Whose password it is, for the device's password manager to file the new one under. */}
      <input type="email" autoComplete="username" value={profile?.email ?? ""} readOnly hidden />
      <PasswordField
        label={account.currentPasswordLabel}
        autoComplete="current-password"
        required
        error={errors.currentPassword?.message}
        {...register("currentPassword")}
      />
      <PasswordField
        label={auth.newPasswordLabel}
        autoComplete="new-password"
        hint={auth.newPasswordHint}
        required
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
    </FormSheet>
  );
}
