"use client";

import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { requestKeys } from "@/lib/api/request-key";
import { formatPaise } from "@/lib/format/currency";
import { useApiMutation } from "@/lib/query/useApiMutation";
import type { BillInput } from "@/lib/validation";

import { BillingClient } from "../api.client";
import { billIssuedRoutes } from "../keys";
import type { BillIssued, BillStart } from "../types";

const { billing: words } = UI_TEXT;

/**
 * Issuing a bill (plan §15.2; D302, D312): no asking first — the preview is
 * the check. Sent twice, it issues once (its idempotency key). Issued,
 * `onIssued` takes the person on, the card says so — "Bill 2026-27/0042
 * issued · ₹500 collected" — and what it billed is read again.
 */
export function useIssueBill(start: BillStart, onIssued: (issued: BillIssued) => void) {
  const respond = useResponse();
  const [keys] = useState(requestKeys);
  const issuing = useApiMutation(BillingClient.issue, {
    revalidate: billIssuedRoutes(start),
    onSuccess: (issued) => {
      keys.settle();
      onIssued(issued);
      respond.success({
        title: words.issued(issued.billNumber),
        message: issued.collectedPaise > 0 ? words.collected(formatPaise(issued.collectedPaise)) : undefined,
      });
    },
    onError: (failure) => respond.failure(failure, { title: words.notIssued }),
  });
  return {
    issue: (input: BillInput) => issuing.submit({ input, key: keys.keyFor(input) }),
    issuing: issuing.submitting,
  };
}
