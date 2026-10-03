"use client";

import { Lock } from "lucide-react";

import { useReadOnly } from "../hooks/useReadOnly";

/**
 * Why the controls beside it are turned off, in a view-only clinic (plan
 * §32.2): "Your clinic is view-only until its plan is renewed." Nothing at
 * all while the clinic may write.
 */
export function ReadOnlyNote() {
  const { readOnly, reason } = useReadOnly();
  if (!readOnly) return null;
  return (
    <p className="mt-2.5 flex items-start gap-2 text-small text-muted">
      <Lock size={16} strokeWidth={2.25} aria-hidden="true" className="mt-0.5 shrink-0" />
      {reason}
    </p>
  );
}
