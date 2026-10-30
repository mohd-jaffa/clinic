"use client";

import { CalendarPlus } from "lucide-react";
import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { PAYMENT_METHOD_LABELS } from "@/constants/statuses";
import { requestKeys } from "@/lib/api/request-key";
import { formatPaise } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import type { ExtendPlanInput, ExtendPlanPayload } from "@/lib/validation";

import { ConsoleClient } from "../api.client";
import type { ConsoleClinicDetail, PlanExtended } from "../types";

const { console: words } = UI_TEXT;

/** What a recorded change says on its card (D376): its last day and receipt; whether the owner was emailed. */
function report(respond: ReturnType<typeof useResponse>, { clinic, payment, emailSent }: PlanExtended) {
  const until = formatDate(payment.validUntil);
  if (emailSent === false) {
    // Recorded, though the email failed: said as the failure it is, closed when read.
    respond.error({ title: words.notEmailed(clinic.name), message: words.notEmailedBody(until) });
    return;
  }
  respond.success({
    title: payment.validUntil < payment.validFrom ? words.moved(clinic.name) : words.extended(clinic.name),
    // Null: the same Extend plan, recorded and emailed the first time it was sent.
    message: emailSent ? words.ownerEmailed(until) : words.runsUntil(until),
    facts: [
      { label: words.lastDayFact, value: until },
      ...(payment.receiptNumber ? [{ label: words.receiptFact, value: payment.receiptNumber }] : []),
    ],
  });
}

/**
 * Extend plan (plan §7.4; D373 – D376): the card asks first — to what day,
 * and what is recorded (AGENTS.md §23). Sent twice, it records once (its
 * idempotency key). Recorded, `onDone` closes the sheet, the card says the
 * new last day, and the console's clinic, its list, the Overview and the
 * audit are read again.
 */
export function useExtendPlan(clinic: ConsoleClinicDetail, onDone: () => void) {
  const respond = useResponse();
  const [keys] = useState(requestKeys);
  const extending = useApiMutation(ConsoleClient.extend, {
    revalidate: [
      apiRoutes.console.clinic(clinic.id),
      apiRoutes.console.clinics,
      apiRoutes.console.overview,
      apiRoutes.console.audit,
    ],
    onError: (failure) => respond.failure(failure, { title: words.notExtended }),
  });
  return {
    submitting: extending.submitting,
    /** `input` as typed, which is sent; `payload` as read, and `lastDay` the day it will run to, for the card. */
    extend: async (input: ExtendPlanInput, { amountPaise, method }: ExtendPlanPayload, lastDay: string) => {
      const later = lastDay >= clinic.validUntil;
      const date = formatDate(lastDay);
      const sure = await respond.confirm({
        title: later ? words.extendAsk(clinic.name, date) : words.moveAsk(clinic.name, date),
        message: method ? words.paidAsk(formatPaise(amountPaise), PAYMENT_METHOD_LABELS[method]) : words.freeAsk,
        confirmLabel: later ? words.extendConfirm : words.moveConfirm,
        confirmIcon: CalendarPlus,
      });
      if (!sure) return;
      const extended = await extending.submit({ clinicId: clinic.id, input, key: keys.keyFor(input) });
      if (extended === undefined) return;
      keys.settle();
      onDone();
      report(respond, extended);
    },
  };
}
