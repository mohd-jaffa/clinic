"use client";

import { Ban } from "lucide-react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { formatPaise } from "@/lib/format/currency";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { BillingClient } from "../api.client";
import { balanceWords } from "../form";
import { paymentRoutes } from "../keys";
import type { Payment } from "../types";

const { payment: words } = UI_TEXT;

/**
 * Voiding a payment or a refund (plan §15.3; D336): with its reason, asking
 * first on a coral card (AGENTS.md §23). Voided, `onDone` closes the
 * sheets, the card says so with the balance now, and what it changed is
 * read again.
 */
export function useVoidPayment(payment: Payment, onDone: () => void) {
  const respond = useResponse();
  const refund = payment.kind === "REFUND";
  const voiding = useApiMutation(BillingClient.voidPayment, {
    revalidate: paymentRoutes(payment.patient.id),
    onSuccess: (voided) => {
      onDone();
      respond.success({
        title: refund ? words.refundVoided : words.voided,
        message: words.balanceNow(balanceWords(voided.balancePaise)),
      });
    },
    onError: (failure) => respond.failure(failure, { title: words.notVoided }),
  });
  return {
    submitting: voiding.submitting,
    void: async (reason: string) => {
      const amount = formatPaise(payment.amountPaise);
      const sure = await respond.confirm({
        title: refund ? words.voidRefundAsk(amount) : words.voidAsk(amount),
        message: words.voidAskMessage,
        confirmLabel: refund ? words.voidRefund : words.void,
        confirmIcon: Ban,
        cancelLabel: words.keep,
        tone: "danger",
      });
      if (sure) await voiding.submit({ paymentId: payment.id, input: { reason } });
    },
  };
}
