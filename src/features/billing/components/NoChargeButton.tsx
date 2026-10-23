"use client";

import { HandHeart } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";
import { hasAccess } from "@/constants/permissions";
import type { BillingStatus } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";

import { NoChargeSheet } from "./NoChargeSheet";

const { billing: words } = UI_TEXT;

/**
 * **No charge** beside **Bill now**, on a done visit waiting in To bill
 * (plan §15.6; D319): its sheet asks why — Review, Courtesy, or Other with
 * a note. For whoever may bill, while the clinic can write and the patient
 * is not archived; once marked, the visit is read again and it goes.
 */
export function NoChargeButton({
  visit,
}: {
  visit: { id: string; billingStatus: BillingStatus | null; patient: { id: string; name: string; archived: boolean } };
}) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const [open, setOpen] = useState(false);
  const mayBill = membership !== null && hasAccess(membership, "payments.create") && !readOnly;
  if (!mayBill || visit.patient.archived || visit.billingStatus !== "TO_BILL") return null;
  const close = () => setOpen(false);
  return (
    <>
      <Button
        label={words.noCharge}
        aria-label={words.noChargeOf(visit.patient.name)}
        icon={HandHeart}
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      />
      <NoChargeSheet visit={visit} open={open} onClose={close} onDone={close} />
    </>
  );
}
