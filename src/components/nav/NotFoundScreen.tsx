"use client";

import { MapPinOff } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { SystemNotice, SystemScreen } from "@/components/ui/system-screen";
import { UI_TEXT } from "@/constants/messages";
import { HOME_ROUTE } from "@/constants/routes";
import { useAuth } from "@/features/auth/AuthProvider";

import { AppShell } from "./AppShell";

/**
 * Any address the app does not have, and any `notFound()` (plan §31.2). For
 * someone signed in it stands inside the shell, so their clinic and its places
 * stay around them and the way on is any of them; for anyone else it stands
 * on its own, as the other stops do.
 */
export function NotFoundScreen() {
  const { status } = useAuth();
  const { system } = UI_TEXT;
  const stop = {
    icon: MapPinOff,
    tone: "land",
    title: system.notFoundTitle,
    body: system.notFoundBody,
    children: <LinkButton href={HOME_ROUTE} label={system.toHome} fullWidth />,
  } as const;

  if (status === "anonymous") return <SystemScreen {...stop} />;
  return (
    <AppShell>
      <div className="flex min-h-[70dvh] px-6">
        <SystemNotice {...stop} />
      </div>
    </AppShell>
  );
}
