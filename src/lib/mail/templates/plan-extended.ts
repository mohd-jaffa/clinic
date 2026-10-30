import { MAIL_TEXT } from "@/constants/messages";
import {
  EXTENSION_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  type ExtensionKind,
  type PaymentMethod,
} from "@/constants/statuses";
import { formatPaise } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";

import { emailHtml, emailText, type EmailParts } from "./layout";

export interface PlanExtendedInput {
  appUrl: string;
  /** The owner. */
  name: string;
  clinicName: string;
  kind: ExtensionKind;
  /** The plan's last day before, and after. */
  validFrom: string;
  validUntil: string;
  amountPaise: number;
  method: PaymentMethod | null;
  paidOn: string | null;
  receiptNumber: string | null;
  reason: string | null;
  /** The owner's Plan screen. */
  planUrl: string;
}

/**
 * Plan extended (plan §22; D375, D376): to the owner, for every change the
 * DEV records — the new last day, then what was recorded: how much, how and
 * when it was paid, and its receipt; or No charge, with the reason given. A
 * date moved earlier, to correct one, says the last day has changed.
 */
export function planExtendedTemplate(input: PlanExtendedInput) {
  const text = MAIL_TEXT.planExtended;
  const until = formatDate(input.validUntil);
  const subject = text.subject(input.clinicName, until);
  const paid =
    input.amountPaise > 0
      ? text.paid(formatPaise(input.amountPaise), PAYMENT_METHOD_LABELS[input.method!], formatDate(input.paidOn))
      : text.noCharge;
  const recorded = [EXTENSION_KIND_LABELS[input.kind], paid, input.reason].filter(Boolean).join(" · ");
  const parts: EmailParts = {
    appUrl: input.appUrl,
    subject,
    preheader: text.preheader,
    heading: input.validUntil < input.validFrom ? text.movedHeading : text.heading,
    paragraphs: [
      MAIL_TEXT.greeting(input.name),
      text.body(input.clinicName, until),
      recorded,
      ...(input.receiptNumber ? [text.receipt(input.receiptNumber)] : []),
    ],
    action: { label: text.action, url: input.planUrl, fallback: MAIL_TEXT.linkFallback },
    footnote: text.footnote(input.clinicName),
  };
  return { subject, text: emailText(parts), html: emailHtml(parts) };
}
