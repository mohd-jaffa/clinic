"use client";

import { Ban, IndianRupee, RotateCcw, UserRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { BILL_FROM, BILLING_ROUTE, newBillRoute, patientRoute, type NewBillFor } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { BILL_PAYMENT_STATE_LABELS, BILL_PAYMENT_STATE_TONES, BILL_STATUS_LABELS } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { BillPdf } from "@/features/documents/components/BillPdf";
import { describePatient } from "@/features/patients/describe";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { dayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";

import { balanceWords } from "../form";
import { useBill } from "../hooks/useBill";
import type { BillDetail } from "../types";
import { Figure } from "./Figure";
import { RecordPaymentSheet } from "./RecordPaymentSheet";
import { VoidBillSheet } from "./VoidBillSheet";

const { bill: words, billing } = UI_TEXT;

/** What a bill billed, for a new one issuing it again (D314): its visit, its arrival, or its patient. */
const targetOf = (bill: BillDetail): NewBillFor =>
  bill.visitId
    ? { visit: bill.visitId }
    : bill.appointmentId
      ? { appointment: bill.appointmentId }
      : { patient: bill.patient.id };

/**
 * A bill's page — `/bills/[id]` (plan §15.2; D314). Its land holds the bill's
 * number, the patient, the day and doctor, and where it stands — Paid, Part
 * paid, Unpaid, or Void. Under it **Print**, **Download** and — a live
 * bill — **WhatsApp**, with its total and what is due (plan §15.5; D341);
 * **Record payment** for `payments.create` while it is Unpaid or Part paid,
 * filled with what is still due on it, the bill read again once recorded;
 * **Void bill** for `payments.edit`, asking a reason and then to be sure;
 * **Re-issue** on a void bill, opening a new bill filled with its lines; and
 * a quiet way to the patient's profile. Then its lines and its figures —
 * side by side from a desktop — and, once void, when, by whom and why.
 *
 * Its back arrow leads to Billing — or, opened from the patient's history,
 * to the profile (D325).
 */
export function BillScreen({ id }: { id: string }) {
  const query = useBill(id);
  const bill = query.data;
  const fromProfile = useSearchParams().get(BILL_FROM.param) === BILL_FROM.patient;
  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader
            title={bill ? words.titleOf(bill.number) : words.title}
            subtitle={bill && `${bill.patient.name} · ${describePatient(bill.patient)}`}
            detail={bill && [words.issued(formatDate(bill.issuedOn)), bill.doctor ?? billing.noDoctor].join(" · ")}
            actions={bill && <BillState bill={bill} />}
            back={fromProfile && bill ? patientRoute(bill.patient.id) : BILLING_ROUTE}
          />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        {bill ? (
          <BillBody bill={bill} />
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed="BILL_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={3} />
          </section>
        )}
      </div>
    </>
  );
}

/** Where the bill stands: Void, or how much of it is paid. */
function BillState({ bill }: { bill: BillDetail }) {
  if (bill.settlement === null) return <StatusPill label={BILL_STATUS_LABELS.VOID} />;
  const { state } = bill.settlement;
  return <StatusPill label={BILL_PAYMENT_STATE_LABELS[state]} tone={BILL_PAYMENT_STATE_TONES[state]} />;
}

function BillBody({ bill }: { bill: BillDetail }) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const [voiding, setVoiding] = useState(false);
  const [paying, setPaying] = useState({ open: false, count: 0 });
  const may = (permission: Parameters<typeof hasAccess>[1]) => membership !== null && hasAccess(membership, permission);
  const writable = !readOnly && !bill.patient.archived;
  const voidable = bill.void === null && writable && may("payments.edit");
  // While something is still due on it (D314).
  const due = bill.settlement !== null && bill.settlement.state !== "PAID" ? bill.settlement.duePaise : null;
  const payable = due !== null && writable && may("payments.create");
  const reissuable = bill.void !== null && writable && may("payments.create");

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <BillPdf
            billId={bill.id}
            patient={bill.patient.name}
            number={bill.number}
            sent={
              bill.settlement && {
                billId: bill.id,
                number: bill.number,
                day: bill.issuedOn,
                patient: bill.patient.name,
                phone: bill.patient.phone,
                totalPaise: bill.totalPaise,
                duePaise: bill.settlement.duePaise,
              }
            }
          />
          {payable && (
            <Button
              label={billing.recordPayment}
              aria-label={billing.recordPaymentFrom(bill.patient.name)}
              icon={IndianRupee}
              variant="primary"
              size="sm"
              onClick={() => setPaying(({ count }) => ({ open: true, count: count + 1 }))}
            />
          )}
          {reissuable && (
            <LinkButton
              href={newBillRoute(targetOf(bill), undefined, bill.id)}
              label={words.reissue}
              accessibleName={words.reissueOf(bill.number)}
              icon={RotateCcw}
              variant="primary"
              size="sm"
            />
          )}
          {voidable && (
            <Button label={words.void} icon={Ban} variant="danger" size="sm" onClick={() => setVoiding(true)} />
          )}
          <LinkButton
            href={patientRoute(bill.patient.id)}
            label={words.openProfile}
            accessibleName={UI_TEXT.appointment.openProfileOf(bill.patient.name)}
            icon={UserRound}
            variant="quiet"
            size="sm"
          />
        </div>
        {(may("payments.edit") || may("payments.create")) && <ReadOnlyNote />}
      </div>
      {bill.void && (
        <div className="flex items-start gap-3 rounded-row bg-surface p-4 sm:p-5">
          <Ban aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-muted" />
          <p className="text-ink">
            <span className="block font-bold">
              {bill.void.by
                ? words.voidedBy(formatDate(dayKey(bill.void.at)), bill.void.by)
                : words.voidedOn(formatDate(dayKey(bill.void.at)))}
            </span>
            <span className="block text-small text-muted">{UI_TEXT.documents.voidReason(bill.void.reason)}</span>
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title={billing.linesTitle}>
          <ul className="grid divide-y divide-line">
            {bill.lines.map((line, index) => (
              <li key={index} className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block font-bold text-ink">{line.description}</span>
                  <span className="block text-small text-muted tabular-nums">
                    {words.times(line.quantity, formatPaise(line.unitPricePaise))}
                  </span>
                </span>
                <span className="font-bold text-ink tabular-nums">{formatPaise(line.amountPaise)}</span>
              </li>
            ))}
          </ul>
          {bill.notes && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-small font-bold text-muted">{billing.notesLabel}</p>
              <p className="whitespace-pre-line text-ink">{bill.notes}</p>
            </div>
          )}
        </Panel>
        <Panel title={billing.totalsTitle}>
          <dl className="grid gap-2.5">
            <Figure label={billing.subtotal} value={formatPaise(bill.subtotalPaise)} />
            {bill.discountPaise > 0 && (
              <Figure label={billing.discount} value={`−${formatPaise(bill.discountPaise)}`} />
            )}
            <Figure label={billing.total} value={formatPaise(bill.totalPaise)} lead />
            {bill.settlement && (
              <>
                <Figure label={words.paid} value={formatPaise(bill.settlement.paidPaise)} />
                <Figure label={words.due} value={formatPaise(bill.settlement.duePaise)} />
              </>
            )}
            <Figure label={words.balance} value={balanceWords(bill.balancePaise)} />
          </dl>
          {bill.issuedBy && <p className="mt-4 text-small text-muted">{words.issuedBy(bill.issuedBy)}</p>}
        </Panel>
      </div>
      {voidable && <VoidBillSheet bill={bill} open={voiding} onClose={() => setVoiding(false)} />}
      {payable && paying.count > 0 && (
        <RecordPaymentSheet
          key={paying.count}
          open={paying.open}
          onClose={() => setPaying((now) => ({ ...now, open: false }))}
          patient={{ ...bill.patient, balancePaise: bill.balancePaise }}
          amountPaise={due}
          billId={bill.id}
        />
      )}
    </div>
  );
}
