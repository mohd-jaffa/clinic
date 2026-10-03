"use client";

import { LogOut } from "lucide-react";

import { IconChip } from "@/components/ui/icon-chip";
import { Row } from "@/components/ui/row";
import { UI_TEXT } from "@/constants/messages";

import { useSignOut } from "../hooks/useSignOut";

/**
 * **Sign out**, as the last row of the More sheet (plan §31.1) and of
 * Settings. It asks first (`useSignOut`); a second tap while it is on its way
 * out does nothing.
 */
export function SignOutRow({ onSignedOut }: { onSignedOut?: () => void }) {
  const { signingOut, signOut } = useSignOut(onSignedOut);
  return (
    <Row
      leading={<IconChip icon={LogOut} />}
      title={UI_TEXT.auth.signOut}
      subtitle={signingOut ? UI_TEXT.auth.signingOut : undefined}
      onClick={() => void signOut()}
    />
  );
}
