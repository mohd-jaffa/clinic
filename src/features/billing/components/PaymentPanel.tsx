"use client";

import { Ban, UserRound } from "lucide-react";
import { useState } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { patientRoute } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { dayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";

import type { Payment } from "../types";
import { VoidPaymentSheet } from "./VoidPaymentSheet";

const { payment: words, bill } = UI_TEXT;

/** What a payment holds, in the order it is read: its day, how, its reference, who took it, its note. */
function detailsOf(payment: Payment): Detail[] {
  const refund = payment.kind === "REFUND";
  const lines: [string, string | null][] = [
    [refund ? words.refundedOn : words.paidOn, formatDate(payment.paidOn)],
    [words.methodLabel, PAYMENT_METHOD_LABELS[payment.method]],
    [words.referenceLabel, payment.reference],
    [refund ? words.handedBackBy : words.receivedBy, payment.receivedBy],
    [words.noteLabel, payment.note],
  ];
  return lines.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/**
 * A payment or a refund opened (plan §15.3; D336) — from Billing's Payments
 * or the patient's history: how much, from — or to — whom, its day, method,
 * reference, who took it and its note; once void, when, by whom and why.
 * **Void payment** for `payments.edit`, while the clinic can write and the
 * patient is not archived, opens the reason over it; closing that comes
 * back here, and voided, everything closes with a card. A quiet **Open
 * profile**, except on the profile itself. The screen keys it by the
 * payment, so each opens afresh.
 */
export function PaymentPanel({
  payment,
  open,
  onClose,
  linkProfile = true,
}: {
  payment: Payment | null;
  open: boolean;
  onClose: () => void;
  linkProfile?: boolean;
}) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const [voiding, setVoiding] = useState(false);
  if (payment === null) return null;
  const refund = payment.kind === "REFUND";
  const voids =
    membership !== null &&
    hasAccess(membership, "payments.edit") &&
    !readOnly &&
    payment.void === null &&
    !payment.patient.archived;
  const done = () => {
    setVoiding(false);
    onClose();
  };
  const voidLine =
    payment.void &&
    (payment.void.by
      ? words.voidedBy(formatDate(dayKey(payment.void.at)), payment.void.by)
      : words.voidedOn(formatDate(dayKey(payment.void.at))));

  return (
    <>
      <Sheet
        open={open && !voiding}
        onClose={done}
        title={PAYMENT_KIND_LABELS[payment.kind]}
        footer={
          (voids || linkProfile) && (
            <div className="flex flex-wrap gap-2">
              {linkProfile && (
                <LinkButton
                  href={patientRoute(payment.patient.id)}
                  label={bill.openProfile}
                  accessibleName={UI_TEXT.appointment.openProfileOf(payment.patient.name)}
                  icon={UserRound}
                  variant="quiet"
                  size="sm"
                />
              )}
              {voids && (
                <Button
                  label={refund ? words.voidRefund : words.void}
                  icon={Ban}
                  variant="danger"
                  size="sm"
                  onClick={() => setVoiding(true)}
                />
              )}
            </div>
          )
        }
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-display font-bold text-ink tabular-nums">{formatPaise(payment.amountPaise)}</span>
            {payment.void && <StatusPill label={PAYMENT_STATUS_LABELS.VOID} />}
          </div>
          <p className="text-body text-ink">
            <span className="font-bold">{payment.patient.name}</span>
            <span className="block text-small text-muted">{UI_TEXT.patients.number(payment.patient.number)}</span>
          </p>
          {payment.void && (
            <p className="text-small text-muted">
              {voidLine}
              <span className="block">{words.voidReason(payment.void.reason)}</span>
            </p>
          )}
          <DetailList details={detailsOf(payment)} />
        </div>
      </Sheet>
      {voids && (
        <VoidPaymentSheet payment={payment} open={open && voiding} onClose={() => setVoiding(false)} onDone={done} />
      )}
    </>
  );
}
