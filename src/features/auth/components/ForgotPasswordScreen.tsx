"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { useResponse } from "@/components/ui/response-card";
import { TextField } from "@/components/ui/text-field";
import { UI_TEXT } from "@/constants/messages";
import { AUTH_ROUTES } from "@/constants/routes";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { emailRequestSchema, type EmailRequestInput, type EmailRequestPayload } from "@/lib/validation";

import { AuthClient } from "../api.client";
import { AuthScene, OtherWayIn } from "./AuthScene";

const { auth } = UI_TEXT;

/**
 * Forgot password (plan §5.3): a link to choose a new one, sent to the email
 * typed. The answer is the same whether or not it has an account — this
 * screen must not become a way to find out who has one — and the card that
 * says so offers the way back to sign in.
 */
export function ForgotPasswordScreen() {
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<EmailRequestInput, unknown, EmailRequestPayload>({
    resolver: zodResolver(emailRequestSchema),
    defaultValues: { email: "" },
  });

  const { submit, submitting } = useApiMutation(AuthClient.requestPasswordReset, {
    onSuccess: () =>
      respond.success({
        title: auth.checkEmailTitle,
        message: auth.resetSentBody,
        primary: { label: auth.backToSignIn, href: AUTH_ROUTES.signIn },
      }),
    onError: (failure) => respond.failure(failure, { title: auth.linkNotSent }),
  });

  return (
    <AuthScene
      title={auth.forgotTitle}
      intro={auth.forgotIntro}
      aside={<OtherWayIn label={auth.backToSignIn} href={AUTH_ROUTES.signIn} />}
    >
      <form method="post" noValidate onSubmit={handleSubmit(() => submit(getValues()))} className="grid gap-5">
        <TextField
          label={auth.emailLabel}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register("email")}
        />
        <Button type="submit" label={auth.sendLink} icon={Send} loading={submitting} fullWidth />
      </form>
    </AuthScene>
  );
}
