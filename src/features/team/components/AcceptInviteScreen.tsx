"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { PhoneField } from "@/components/ui/phone-field";
import { useResponse } from "@/components/ui/response-card";
import { ScreenNotice } from "@/components/ui/screen-notice";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { TEXT_LIMITS } from "@/constants/limits";
import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { AUTH_ROUTES, HOME_ROUTE } from "@/constants/routes";
import { AuthScene, OtherWayIn } from "@/features/auth/components/AuthScene";
import { PasswordField } from "@/features/auth/components/PasswordField";
import { ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/errors";
import { loadPage } from "@/lib/navigation/url";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { acceptInviteSchema, type AcceptInviteInput, type AcceptInvitePayload } from "@/lib/validation";

import type { InvitePreview } from "../accept";
import { TeamClient } from "../api.client";
import { takeInviteToken } from "../link";

const { acceptInvite, auth } = UI_TEXT;

type Opening =
  | { state: "opening" }
  | { state: "ready"; token: string; invite: InvitePreview }
  | { state: "gone"; code: "INVITE_INVALID" | "INVITE_EXPIRED" }
  | { state: "failed"; token: string; failure: unknown };

/** Why a link opens onto nothing, from the API's refusal; anything else is a failure to try again. */
const goneCode = (failure: unknown) =>
  failure instanceof ApiError && (failure.code === "INVITE_INVALID" || failure.code === "INVITE_EXPIRED")
    ? failure.code
    : null;

/**
 * Where an invite's link lands (plan §8.5, D63, D91, D92): the token is
 * taken from the address and wiped from it; the screen names the clinic and
 * the role; the person confirms their name, adds their mobile and chooses a
 * password, and lands on Home, signed in — whoever was signed in on the
 * device before. A link used, revoked or run out says so, and how to get
 * another.
 */
export function AcceptInviteScreen() {
  const [opening, setOpening] = useState<Opening>({ state: "opening" });

  const open = async (token: string) => {
    try {
      setOpening({ state: "ready", token, invite: await TeamClient.previewInvite(token) });
    } catch (failure) {
      const code = goneCode(failure);
      setOpening(code ? { state: "gone", code } : { state: "failed", token, failure });
    }
  };

  useEffect(() => {
    const token = takeInviteToken();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the token is only in the browser's address, read once the page is drawn.
    if (!token) setOpening({ state: "gone", code: "INVITE_INVALID" });
    else void open(token);
  }, []);

  if (opening.state === "gone") {
    return (
      <AuthScene
        title={opening.code === "INVITE_EXPIRED" ? acceptInvite.expiredTitle : acceptInvite.invalidTitle}
        aside={<OtherWayIn label={auth.backToSignIn} href={AUTH_ROUTES.signIn} />}
      >
        <ScreenNotice>{ERROR_MESSAGES[opening.code]}</ScreenNotice>
      </AuthScene>
    );
  }

  if (opening.state === "ready") {
    const { invite, token } = opening;
    return (
      <AuthScene
        title={acceptInvite.title(invite.clinicName)}
        intro={acceptInvite.intro(acceptInvite.roles[invite.role], invite.email)}
      >
        <AcceptForm token={token} invite={invite} onGone={(code) => setOpening({ state: "gone", code })} />
      </AuthScene>
    );
  }

  return (
    <AuthScene title={acceptInvite.opening}>
      {opening.state === "failed" ? (
        <div className="grid gap-5">
          <ScreenNotice>{errorMessage(opening.failure)}</ScreenNotice>
          <Button label={UI_TEXT.actions.retry} fullWidth onClick={() => void open(opening.token)} />
        </div>
      ) : (
        <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
          <SkeletonRows rows={3} />
        </section>
      )}
    </AuthScene>
  );
}

function AcceptForm({
  token,
  invite,
  onGone,
}: {
  token: string;
  invite: InvitePreview;
  onGone: (code: "INVITE_INVALID" | "INVITE_EXPIRED") => void;
}) {
  const respond = useResponse();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<AcceptInviteInput, unknown, AcceptInvitePayload>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { token, fullName: invite.fullName, phone: "", password: "" },
  });

  const { submit, submitting } = useApiMutation(TeamClient.acceptInvite, {
    // A new page: the session is new, and nothing of whoever was here before stays (D92).
    onSuccess: () => loadPage(HOME_ROUTE),
    onError: (failure) => {
      const code = goneCode(failure);
      if (code) onGone(code);
      else respond.failure(failure, { title: acceptInvite.notJoined });
    },
  });

  return (
    <form
      method="post"
      noValidate
      // The password exactly as typed: never trimmed or changed (AGENTS.md §24).
      onSubmit={handleSubmit(() => submit(getValues()))}
      className="grid gap-5"
    >
      <TextField
        label={acceptInvite.nameLabel}
        autoComplete="name"
        maxLength={TEXT_LIMITS.personName}
        required
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <PhoneField
        label={acceptInvite.phoneLabel}
        hint={auth.phoneHint}
        required
        error={errors.phone?.message}
        {...register("phone")}
      />
      <PasswordField
        label={acceptInvite.passwordLabel}
        autoComplete="new-password"
        hint={acceptInvite.passwordHint}
        required
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" label={acceptInvite.join} icon={Check} loading={submitting} fullWidth />
    </form>
  );
}
