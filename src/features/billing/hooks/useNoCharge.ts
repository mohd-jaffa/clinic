"use client";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { useApiMutation } from "@/lib/query/useApiMutation";
import type { NoChargeInput } from "@/lib/validation";

import { BillingClient } from "../api.client";
import { noChargeRoutes } from "../keys";

const { billing: words } = UI_TEXT;

/**
 * No charge (plan §15.6; D319): a visit waiting in To bill settled free,
 * with its reason — no asking first; a bill may still be issued for it
 * later (D287). Marked, `onDone` closes the sheet, the card says so, and To
 * bill, the queue and the visit are read again.
 */
export function useNoCharge(visit: { id: string; patient: { id: string; name: string } }, onDone: () => void) {
  const respond = useResponse();
  const marking = useApiMutation(BillingClient.noCharge, {
    revalidate: noChargeRoutes(visit.id, visit.patient.id),
    onSuccess: () => {
      onDone();
      respond.success({ title: words.noCharged(visit.patient.name) });
    },
    onError: (failure) => respond.failure(failure, { title: words.notNoCharged }),
  });
  return {
    submitting: marking.submitting,
    mark: (input: NoChargeInput) => marking.submit({ visitId: visit.id, input }),
  };
}
