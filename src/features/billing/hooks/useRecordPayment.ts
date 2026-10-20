"use client";

import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import type { PaymentKind } from "@/constants/statuses";
import { requestKeys } from "@/lib/api/request-key";
import { formatPaise } from "@/lib/format/currency";
import { parseRupees } from "@/lib/money";
import { useApiMutation } from "@/lib/query/useApiMutation";
import type { PaymentInput } from "@/lib/validation";

import { BillingClient } from "../api.client";
import { balanceWords } from "../form";
import { paymentRoutes } from "../keys";

const { payment: words } = UI_TEXT;

/**
 * Recording a payment, or a refund (plan §15.3; D322 – D324): no asking
 * first. Sent twice, it records once (its idempotency key). Recorded,
 * `onDone` closes the sheet, the card says how much from — or to — whom,
 * and the balance now; what it changes is read again, the bill it was
 * recorded from among it.
 */
export function useRecordPayment({
  kind,
  patient,
  billId,
  onDone,
}: {
  kind: PaymentKind;
  /** Who it is from, or to: chosen in the sheet, or none yet. */
  patient: { id: string; name: string } | null;
  billId?: string;
  onDone: () => void;
}) {
  const respond = useResponse();
  const [keys] = useState(requestKeys);
  const refund = kind === "REFUND";
  const recording = useApiMutation(BillingClient.record, {
    revalidate: patient ? paymentRoutes(patient.id, billId) : [],
    onError: (failure) => respond.failure(failure, { title: refund ? words.notRefunded : words.notRecorded }),
  });
  return {
    submitting: recording.submitting,
    record: async (input: PaymentInput, name: string) => {
      const recorded = await recording.submit({ input, key: keys.keyFor(input) });
      if (recorded === undefined) return;
      keys.settle();
      onDone();
      const amount = formatPaise(parseRupees(input.amount));
      respond.success({
        title: refund ? words.refunded(amount, name) : words.recorded(amount, name),
        message: words.balanceNow(balanceWords(recorded.balancePaise)),
      });
    },
  };
}
