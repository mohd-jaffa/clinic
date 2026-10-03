"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button, LinkButton } from "@/components/ui/button";
import { useResponse } from "@/components/ui/response-card";
import { ScreenNotice } from "@/components/ui/screen-notice";
import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { AUTH_ROUTES, HOME_ROUTE } from "@/constants/routes";
import { ApiError } from "@/lib/api/client";
import { loadPage } from "@/lib/navigation/url";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { newPasswordSchema, type NewPasswordInput, type NewPasswordPayload } from "@/lib/validation";

import { AuthClient } from "../api.client";
import { takeLinkTokens, type LinkTokens } from "../link";
import { AuthScene, OtherWayIn } from "./AuthScene";
import { PasswordField } from "./PasswordField";

const { auth } = UI_TEXT;

type Reset = { state: "opening" } | { state: "ready"; tokens: LinkTokens } | { state: "expired" };

/**
 * Where the reset link lands (plan §5.3): a new password, saved with the
 * link's session — held in memory only, wiped from the address as the screen
 * opens — and the person signed in, on a new page at Home. A link used twice
 * or too late, or none at all, is sent to ask for a new one.
 */
export function ResetPasswordScreen() {
  const [reset, setReset] = useState<Reset>({ state: "opening" });

  useEffect(() => {
    const found = takeLinkTokens();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the link's tokens are only in the browser's address, read once the page is drawn.
    setReset(found.tokens ? { state: "ready", tokens: found.tokens } : { state: "expired" });
  }, []);

  if (reset.state === "expired") {
    return (
      <AuthScene
        title={auth.linkExpiredTitle}
        aside={<OtherWayIn label={auth.backToSignIn} href={AUTH_ROUTES.signIn} />}
      >
        <div className="grid gap-5">
          <ScreenNotice>{ERROR_MESSAGES.AUTH_LINK_INVALID}</ScreenNotice>
          <LinkButton href={AUTH_ROUTES.forgotPassword} label={auth.askForNewLink} fullWidth />
        </div>
      </AuthScene>
    );
  }

  return (
    <AuthScene title={auth.resetTitle} intro={auth.resetIntro}>
      {reset.state === "ready" && (
        <NewPasswordForm tokens={reset.tokens} onExpired={() => setReset({ state: "expired" })} />
      )}
    </AuthScene>
  );
}

function NewPasswordForm({ tokens, onExpired }: { tokens: LinkTokens; onExpired: () => void }) {
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<NewPasswordInput, unknown, NewPasswordPayload>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "" },
  });

  const { submit, submitting } = useApiMutation(AuthClient.completePasswordReset, {
    onSuccess: () => loadPage(HOME_ROUTE),
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === "AUTH_LINK_INVALID") onExpired();
      else respond.failure(failure, { title: auth.passwordNotSaved });
    },
  });

  return (
    <form
      method="post"
      noValidate
      // The password exactly as typed: never trimmed or changed (AGENTS.md §24).
      onSubmit={handleSubmit(() => submit({ ...tokens, password: getValues("password") }))}
      className="grid gap-5"
    >
      <PasswordField
        label={auth.newPasswordLabel}
        autoComplete="new-password"
        hint={auth.newPasswordHint}
        required
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" label={auth.savePassword} icon={Check} loading={submitting} fullWidth />
    </form>
  );
}
