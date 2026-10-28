"use client";

import { useId } from "react";

import { Row, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { UI_TEXT } from "@/constants/messages";
import { EXTENSION_KIND_LABELS, PAYMENT_METHOD_LABELS } from "@/constants/statuses";
import { formatPaise } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";

import type { PlanPayment } from "../types";

const { plan: words } = UI_TEXT;

/** What it was, when it was paid and how — or, at no charge, the day it was given — then why the date was set by hand. */
const lineOf = (payment: PlanPayment) =>
  [
    payment.kind === "CUSTOM" ? words.dateChanged : EXTENSION_KIND_LABELS[payment.kind],
    payment.paidOn ? words.paidOn(formatDate(payment.paidOn)) : formatDate(payment.recordedOn),
    payment.method && PAYMENT_METHOD_LABELS[payment.method],
    payment.reference,
    payment.reason,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * The plan's history (plan §7.5; D366): every change the DEV recorded to its
 * last day, the latest first — the day it runs to, then a month or a year
 * paid for, or days given or a date put right, marked **No charge**, with
 * the reason they gave, so the owner sees why the date moved. The line under
 * each is read whole.
 */
export function PlanHistory({ payments }: { payments: PlanPayment[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={words.history} />
      {payments.length === 0 ? (
        <p className="text-small text-muted">{words.noHistory}</p>
      ) : (
        <RowList label={words.history}>
          {payments.map((payment) => (
            <Row
              key={payment.id}
              // The day it runs to, short enough never to be cut beside its amount on a phone.
              title={words.until(formatDate(payment.validUntil))}
              subtitle={lineOf(payment)}
              detail={payment.amountPaise > 0 ? formatPaise(payment.amountPaise) : words.noCharge}
              wrap
            />
          ))}
        </RowList>
      )}
    </section>
  );
}
