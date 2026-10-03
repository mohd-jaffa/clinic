"use client";

import { CircleAlert, RotateCcw } from "lucide-react";

import { Button, LinkButton } from "@/components/ui/button";
import { SystemScreen } from "@/components/ui/system-screen";
import { UI_TEXT } from "@/constants/messages";
import { HOME_ROUTE } from "@/constants/routes";

/**
 * A screen that failed while it was drawn ends here rather than on a blank
 * page (plan §31.2). The error's own message is never shown — in production
 * it is withheld anyway — only the digest the error log carries
 * (`instrumentation.ts`), to quote when asking for help.
 */
export default function ScreenError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { system } = UI_TEXT;
  return (
    <SystemScreen
      icon={CircleAlert}
      tone="attention"
      title={system.errorTitle}
      body={system.errorBody}
      reference={error.digest && UI_TEXT.response.reference(error.digest)}
    >
      <Button label={UI_TEXT.actions.retry} icon={RotateCcw} fullWidth onClick={retry} />
      <LinkButton href={HOME_ROUTE} label={system.toHome} variant="secondary" fullWidth />
    </SystemScreen>
  );
}
