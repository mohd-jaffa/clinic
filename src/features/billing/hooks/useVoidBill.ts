"use client";

import { Ban } from "lucide-react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { BillingClient } from "../api.client";
import { billVoidedRoutes } from "../keys";
import type { BillDetail } from "../types";

const { bill: words } = UI_TEXT;

/**
 * Voiding a bill (plan §15.2; D314): with its reason, asking first on a
 * coral card (AGENTS.md §23). Voided, `onDone` closes the sheet, the card
 * says so — and that its visit is back in To bill, when it is — and what it
 * billed is read again.
 */
export function useVoidBill(bill: BillDetail, onDone: () => void) {
  const respond = useResponse();
  const voiding = useApiMutation(BillingClient.void, {
    revalidate: billVoidedRoutes(bill),
    onSuccess: (voided) => {
      onDone();
      respond.success({
        title: words.voided(bill.number),
        message: voided.visitToBill ? words.visitBackToBill : undefined,
      });
    },
    onError: (failure) => respond.failure(failure, { title: words.notVoided }),
  });
  return {
    submitting: voiding.submitting,
    void: async (reason: string) => {
      const sure = await respond.confirm({
        title: words.voidAsk(bill.number),
        message: words.voidAskMessage,
        confirmLabel: words.void,
        confirmIcon: Ban,
        cancelLabel: words.keep,
        tone: "danger",
      });
      if (sure) await voiding.submit({ billId: bill.id, input: { reason } });
    },
  };
}
