"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { useResponse } from "@/components/ui/response-card";
import { TextField } from "@/components/ui/text-field";
import { UI_TEXT } from "@/constants/messages";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { emailRequestSchema, type EmailRequestInput, type EmailRequestPayload } from "@/lib/validation";

import { AuthClient } from "../api.client";

const { auth } = UI_TEXT;

/**
 * **Send the link again** (plan §5.1): to the address just signed up with,
 * or — arriving with none, or with a link that has expired — to the one typed
 * here. The answer is the same whoever asks, so it never tells whether an
 * address has an account; the server keeps a pause between sends.
 */
export function ResendConfirmation({ email }: { email?: string }) {
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<EmailRequestInput, unknown, EmailRequestPayload>({
    resolver: zodResolver(emailRequestSchema),
    defaultValues: { email: email ?? "" },
  });

  const { submit, submitting } = useApiMutation(AuthClient.resendConfirmation, {
    onSuccess: () => respond.success({ title: auth.linkSent, message: auth.linkSentBody }),
    onError: (failure) => respond.failure(failure, { title: auth.linkNotSent }),
  });

  return (
    <form method="post" noValidate onSubmit={handleSubmit(() => submit(getValues()))} className="grid gap-5">
      {!email && (
        <TextField
          label={auth.emailLabel}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register("email")}
        />
      )}
      <Button
        type="submit"
        label={auth.resendLink}
        icon={Send}
        variant={email ? "secondary" : "primary"}
        loading={submitting}
        fullWidth
      />
    </form>
  );
}
