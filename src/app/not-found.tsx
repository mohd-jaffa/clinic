import type { Metadata } from "next";
import { MapPinOff } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { SystemScreen } from "@/components/ui/system-screen";
import { UI_TEXT } from "@/constants/messages";
import { HOME_ROUTE } from "@/constants/routes";

export const metadata: Metadata = { title: UI_TEXT.system.notFoundTitle };

/** Any address the app does not have, and any `notFound()` (plan §31.2). */
export default function NotFound() {
  const { system } = UI_TEXT;
  return (
    <SystemScreen icon={MapPinOff} tone="land" title={system.notFoundTitle} body={system.notFoundBody}>
      <LinkButton href={HOME_ROUTE} label={system.toHome} fullWidth />
    </SystemScreen>
  );
}
