"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { useResponse } from "@/components/ui/response-card";
import { TextField } from "@/components/ui/text-field";
import { UI_TEXT } from "@/constants/messages";
import { ADMIN_ROUTE, AUTH_ROUTES, RETURN_TO_PARAM, returnToPath } from "@/constants/routes";
import { ApiError } from "@/lib/api/client";
import { loadPage } from "@/lib/navigation/url";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { loginSchema, type LoginInput, type LoginPayload } from "@/lib/validation";

import { AuthClient } from "../api.client";
import { AuthScene, OtherWayIn } from "./AuthScene";
import { PasswordField } from "./PasswordField";

const { auth } = UI_TEXT;

/**
 * Signing in (plan §5.2): an email or a mobile number, and the password. A
 * new page follows for the account now signed in, drawn by the server with
 * its data: the screen the person was heading for, Home, or — for the
 * platform admin — the console. An email not yet confirmed is offered the link
 * again.
 */
export function SignInScreen() {
  const returnTo = returnToPath(useSearchParams().get(RETURN_TO_PARAM));
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput, unknown, LoginPayload>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const { submit, submitting } = useApiMutation(AuthClient.signIn, {
    onSuccess: (session) => loadPage(session.profile.platformRole === "DEV" ? ADMIN_ROUTE : returnTo),
    onError: (failure) =>
      respond.failure(failure, {
        title: auth.signInFailed,
        fallback: "AUTH_INVALID_CREDENTIALS",
        primary:
          failure instanceof ApiError && failure.code === "AUTH_EMAIL_NOT_CONFIRMED"
            ? { label: auth.resendLink, href: AUTH_ROUTES.confirmEmail }
            : undefined,
      }),
  });

  return (
    <AuthScene
      title={auth.signIn}
      intro={auth.signInIntro}
      aside={<OtherWayIn question={auth.newHere} label={auth.setUpClinic} href={AUTH_ROUTES.register} />}
    >
      {/* What was typed goes as typed; the route reads it with the same schema. */}
      <form method="post" noValidate onSubmit={handleSubmit(() => submit(getValues()))} className="grid gap-5">
        <TextField
          label={auth.identifierLabel}
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          error={errors.identifier?.message}
          {...register("identifier")}
        />
        <div>
          <PasswordField
            label={auth.passwordLabel}
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register("password")}
          />
          <Link
            href={AUTH_ROUTES.forgotPassword}
            className="mt-1 inline-flex min-h-11 items-center text-small font-bold text-action underline-offset-4 hover:underline"
          >
            {auth.forgotPassword}
          </Link>
        </div>
        <Button type="submit" label={auth.signIn} loading={submitting} fullWidth />
      </form>
    </AuthScene>
  );
}
