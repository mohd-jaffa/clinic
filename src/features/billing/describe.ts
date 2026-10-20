import { UI_TEXT } from "@/constants/messages";
import { PAYMENT_METHOD_LABELS } from "@/constants/statuses";
import { todayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { formatNearDate } from "@/lib/format/date";

import type { Payment, ToBillVisit } from "./types";

const { billing: words, payment, appointment } = UI_TEXT;

/**
 * Who saw a visit waiting in To bill, its token and its day (D318): the
 * doctor when every doctor's are shown; the day only when it is not today.
 */
export function toBillAbout(visit: ToBillVisit, showDoctor: boolean, today: string = todayKey()): string {
  return [
    showDoctor && (visit.doctor ? (visit.doctor.name ?? appointment.formerDoctor) : words.noDoctor),
    visit.token !== null && words.token(visit.token),
    visit.day !== today && formatNearDate(visit.day, today),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * What was done in a visit waiting in To bill (D318): the consultation —
 * unless its fee was paid at arrival — and the treatments worked on.
 */
export function toBillWorked(visit: ToBillVisit): string {
  return [...(visit.feePaid ? [] : [words.consultation]), ...visit.treatments].join(" · ");
}

/** A payment as a line (D325): "Paid ₹500 · UPI", or "Refunded ₹500 · Cash". */
export function paymentLine({ kind, amountPaise, method }: Pick<Payment, "kind" | "amountPaise" | "method">): string {
  const amount = formatPaise(amountPaise);
  return kind === "REFUND"
    ? payment.refundedLine(amount, PAYMENT_METHOD_LABELS[method])
    : payment.paidLine(amount, PAYMENT_METHOD_LABELS[method]);
}
