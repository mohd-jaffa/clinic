"use client";

import { useEffect, useState } from "react";

import { ScreenNotice } from "@/components/ui/screen-notice";
import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { AUTH_ROUTES, HOME_ROUTE } from "@/constants/routes";
import { errorMessage } from "@/lib/errors/errorMessage";
import { loadPage } from "@/lib/navigation/url";

import { AuthClient } from "../api.client";
import { takeLinkTokens } from "../link";
import { AuthScene, OtherWayIn } from "./AuthScene";
import { ResendConfirmation } from "./ResendConfirmation";

const { auth } = UI_TEXT;

type Confirmation = { state: "confirming" } | { state: "waiting" } | { state: "failed"; message: string };

/**
 * Where the confirmation link lands (plan §5.1). With the link's tokens, the
 * email is confirmed and the owner signed in, on a new page at Home. A link
 * used twice or too late, or arriving with none — someone who lost the email
 * — is offered the link again, to the address they type.
 */
export function ConfirmEmailScreen() {
  const [confirmation, setConfirmation] = useState<Confirmation>({ state: "confirming" });

  useEffect(() => {
    const found = takeLinkTokens();
    const confirm = async () => {
      if (!found.tokens) {
        setConfirmation(
          found.expired ? { state: "failed", message: ERROR_MESSAGES.AUTH_LINK_INVALID } : { state: "waiting" },
        );
        return;
      }
      try {
        await AuthClient.confirmEmail(found.tokens);
        loadPage(HOME_ROUTE);
      } catch (failure) {
        setConfirmation({ state: "failed", message: errorMessage(failure, "AUTH_LINK_INVALID") });
      }
    };
    void confirm();
  }, []);

  const back = <OtherWayIn label={auth.backToSignIn} href={AUTH_ROUTES.signIn} />;

  if (confirmation.state === "confirming") {
    return (
      <AuthScene title={auth.checkEmailTitle}>
        <p role="status" className="text-muted">
          {auth.confirming}
        </p>
      </AuthScene>
    );
  }

  if (confirmation.state === "failed") {
    return (
      <AuthScene title={auth.linkExpiredTitle} aside={back} announce>
        <div className="grid gap-5">
          <ScreenNotice>{confirmation.message}</ScreenNotice>
          <ResendConfirmation />
        </div>
      </AuthScene>
    );
  }

  return (
    <AuthScene title={auth.checkEmailTitle} intro={auth.checkEmailIntro} aside={back}>
      <ResendConfirmation />
    </AuthScene>
  );
}
