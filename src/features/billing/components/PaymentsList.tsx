"use client";

import { Wallet } from "lucide-react";

import { DateRangeFilter } from "@/components/ui/date-range";
import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { Row, RowList } from "@/components/ui/row";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { BILLING_TAB_LABELS, PAYMENT_KIND_LABELS, PAYMENT_STATUS_LABELS } from "@/constants/statuses";
import type { DateRange } from "@/lib/dates/range";
import { formatNearDate } from "@/lib/format/date";
import { useOpened } from "@/hooks/useOpened";

import { paymentLine } from "../describe";
import { usePayments } from "../hooks/usePayments";
import type { Payment } from "../types";
import { PaymentPanel } from "./PaymentPanel";

const { billing: words } = UI_TEXT;

/**
 * Billing's Payments (plan §15.4; D320, D335, D336): the payments and
 * refunds paid on the days picked — Today to start — voided ones too, newest
 * first, a page at a time. Each row its patient, how much and how, its day
 * and who took it; each opens its sheet, where it may be voided.
 */
export function PaymentsList({ range, onRange }: { range: DateRange; onRange: (range: DateRange) => void }) {
  const query = usePayments(range);
  const opened = useOpened<Payment>();
  return (
    <div className="grid gap-4">
      <DateRangeFilter value={range} onChange={onRange} />
      <ListScreen
        query={query}
        loadFailed="PAYMENTS_LOAD_FAILED"
        data={query.data}
        empty={<EmptyState icon={Wallet} title={words.paymentsEmpty} hint={words.paymentsEmptyHint} />}
        renderList={(payments) => (
          <RowList label={BILLING_TAB_LABELS.PAYMENTS}>
            {payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} onOpen={opened.show} />
            ))}
          </RowList>
        )}
      />
      <PaymentPanel key={opened.item?.id} payment={opened.item} open={opened.open} onClose={opened.close} />
    </div>
  );
}

/** A payment or a refund (D320): its patient, how much and how, its day and who took it; a void one quiet. */
function PaymentRow({ payment, onOpen }: { payment: Payment; onOpen: (payment: Payment) => void }) {
  return (
    <Row
      look={payment.void ? "quiet" : "surface"}
      title={payment.patient.name}
      subtitle={paymentLine(payment)}
      note={[formatNearDate(payment.paidOn), payment.receivedBy].filter(Boolean).join(" · ")}
      detail={
        payment.void ? (
          <StatusPill label={PAYMENT_STATUS_LABELS.VOID} />
        ) : payment.kind === "REFUND" ? (
          <StatusPill label={PAYMENT_KIND_LABELS.REFUND} />
        ) : undefined
      }
      onClick={() => onOpen(payment)}
    />
  );
}
