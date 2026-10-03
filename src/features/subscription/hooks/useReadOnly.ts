"use client";

import { UI_TEXT } from "@/constants/messages";
import { useAuth } from "@/features/auth/AuthProvider";

/**
 * Whether the clinic is view-only (plan §7.2): its plan ended, and its grace
 * with it. The session view already says so, so no screen asks again. A
 * control that would write is turned off and says why — `reason` — while
 * the server and the database refuse the write anyway (AGENTS.md §11).
 */
export function useReadOnly(): { readOnly: boolean; reason: string } {
  const { subscription } = useAuth();
  return { readOnly: subscription?.state === "READ_ONLY", reason: UI_TEXT.plan.readOnlyReason };
}
