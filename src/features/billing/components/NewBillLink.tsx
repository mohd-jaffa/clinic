"use client";

import { ReceiptIndianRupee } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";
import { newBillRoute, type NewBillFor } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";

const { billing: words } = UI_TEXT;

/**
 * Where a new bill is started from a screen (plan §15.2): **Bill now** at the
 * foot of a visit (D307), **New bill** on a profile, beside New visit
 * (D311) — for whoever may issue a bill, while the clinic can write and the
 * patient is not archived.
 */
export function NewBillLink({
  target,
  patient,
  look,
}: {
  target: NewBillFor;
  patient: { name: string; archived: boolean };
  look: "visit" | "profile";
}) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  if (membership === null || !hasAccess(membership, "payments.create") || readOnly || patient.archived) return null;
  const visit = look === "visit";
  return (
    <LinkButton
      href={newBillRoute(target)}
      label={visit ? words.billNow : words.newBill}
      accessibleName={visit ? words.billNowOf(patient.name) : words.newBillOf(patient.name)}
      icon={ReceiptIndianRupee}
      variant={visit ? "primary" : "secondary"}
      size="sm"
    />
  );
}
