"use client";

import { MessageCircle, Printer, ReceiptIndianRupee } from "lucide-react";
import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { billRoute } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useBillSend } from "@/features/documents/hooks/useBillSend";
import { requestKeys } from "@/lib/api/request-key";
import { todayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import type { BillInput } from "@/lib/validation";

import { BillingClient } from "../api.client";
import { dueOnNewest } from "../form";
import { billIssuedRoutes } from "../keys";
import type { BillIssued, BillStart } from "../types";

const { billing: words, bill } = UI_TEXT;

/**
 * Issuing a bill (plan §15.2; D302, D312): no asking first — the preview is
 * the check. Sent twice, it issues once (its idempotency key). Issued,
 * `onIssued` takes the person on, the card says so — "Bill 2026-27/0042
 * issued · ₹500 collected" — and stays up with **Print** (the PDF),
 * **WhatsApp** — the bill sent with its total and what is still due on it
 * (D327, D341) — and **View bill** (its page, D317), for whoever may read
 * bills; what it billed is read again.
 */
export function useIssueBill(start: BillStart, onIssued: (issued: BillIssued) => void) {
  const respond = useResponse();
  const { membership } = useAuth();
  const readsBills = membership !== null && hasAccess(membership, "payments.view");
  const [keys] = useState(requestKeys);
  const sending = useBillSend();
  const issuing = useApiMutation(BillingClient.issue, {
    revalidate: billIssuedRoutes(start),
    onSuccess: (issued) => {
      keys.settle();
      onIssued(issued);
      respond.success({
        title: words.issued(issued.billNumber),
        message: issued.collectedPaise > 0 ? words.collected(formatPaise(issued.collectedPaise)) : undefined,
        ...(readsBills && {
          primary: { label: bill.print, href: apiRoutes.bills.pdf(issued.billId), file: true, icon: Printer },
          secondary: {
            label: bill.whatsApp,
            icon: MessageCircle,
            onClick: () =>
              void sending.send({
                billId: issued.billId,
                number: issued.billNumber,
                day: todayKey(),
                patient: start.patient.name,
                phone: start.patient.phone,
                totalPaise: issued.totalPaise,
                duePaise: dueOnNewest(issued),
              }),
          },
          tertiary: { label: words.viewBill, href: billRoute(issued.billId), icon: ReceiptIndianRupee },
        }),
      });
    },
    onError: (failure) => respond.failure(failure, { title: words.notIssued }),
  });
  return {
    issue: (input: BillInput) => issuing.submit({ input, key: keys.keyFor(input) }),
    issuing: issuing.submitting,
  };
}
