"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";

import { useAuth } from "../AuthProvider";

/**
 * **Sign out**, asked first (AGENTS.md §23): it cannot be taken back without
 * the password, so a confirm card stands before it. Once agreed, `onSignedOut`
 * runs — a sheet or menu it sat in closes — and a second tap while it is on
 * its way out does nothing.
 */
export function useSignOut(onSignedOut?: () => void) {
  const { signOut } = useAuth();
  const respond = useResponse();
  const [signingOut, setSigningOut] = useState(false);

  const askThenSignOut = async () => {
    if (signingOut) return;
    const sure = await respond.confirm({
      title: UI_TEXT.auth.signOutTitle,
      message: UI_TEXT.auth.signOutBody,
      confirmLabel: UI_TEXT.auth.signOut,
      confirmIcon: LogOut,
      cancelLabel: UI_TEXT.auth.staySignedIn,
    });
    if (!sure) return;
    setSigningOut(true);
    onSignedOut?.();
    await signOut();
  };

  return { signingOut, signOut: askThenSignOut };
}
