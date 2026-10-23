"use client";

import { CalendarDays } from "lucide-react";
import { useId } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { Row, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { HISTORY_MEDICINES_NAMED, HISTORY_TREATMENTS_NAMED } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { BILL_FROM, billRoute, VISIT_FROM, visitRoute } from "@/constants/navigation";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_TONES,
  BILL_LIST_STATE_LABELS,
  BILL_LIST_STATE_TONES,
  PAYMENT_KIND_LABELS,
  PAYMENT_STATUS_LABELS,
  VISIT_STATUS_LABELS,
  VISIT_STATUS_TONES,
} from "@/constants/statuses";
import { isLive } from "@/features/appointments/calendar";
import { kindOf } from "@/features/appointments/describe";
import type { CalendarAppointment, PatientAppointment } from "@/features/appointments/types";
import { PaymentPanel } from "@/features/billing/components/PaymentPanel";
import { paymentLine } from "@/features/billing/describe";
import type { PatientBill, Payment } from "@/features/billing/types";
import type { PatientVisit } from "@/features/visits/types";
import { useOpened } from "@/hooks/useOpened";
import { dayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { formatDate, formatTime } from "@/lib/format/date";

import { usePatientTimeline } from "../hooks/usePatientTimeline";
import type { Patient, TimelineEntry } from "../types";

const { patients, appointment: words } = UI_TEXT;

/**
 * A patient's history (plan §10.3; D167, D225 – D227, D325): one list,
 * newest first, a page at a time — their visits, each standing for the
 * appointment it was opened for; the appointments that have none: those
 * still to come, cancelled or missed; their bills; and their payments and
 * refunds. A visit says its day, its doctor, what it found and its
 * medicines, or that it holds nothing, and opens its screen; an appointment
 * says its day and time, its doctor and kind, where it stands — a cancelled
 * one why, quiet like a no-show — and opens its detail; a bill its number,
 * day, total and where it stands, opening its page, which leads back here;
 * a payment how much and how, its day and who took it, opening its sheet
 * (D336). Each part only for those who may see it.
 */
export function PatientHistory({
  patient,
  onOpen,
}: {
  patient: Patient;
  onOpen: (appointment: CalendarAppointment) => void;
}) {
  const query = usePatientTimeline(patient.id);
  const opened = useOpened<Payment>();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} title={patients.history} />
      <ListScreen
        query={query}
        loadFailed="HISTORY_LOAD_FAILED"
        data={query.data}
        empty={<EmptyState icon={CalendarDays} title={patients.historyEmpty} hint={patients.historyEmptyHint} />}
        renderList={(entries) => (
          <RowList label={patients.history}>
            {entries.map((entry) => (
              <EntryRow key={keyOf(entry)} entry={entry} onOpen={onOpen} onOpenPayment={opened.show} />
            ))}
          </RowList>
        )}
      />
      <PaymentPanel
        key={opened.item?.id}
        payment={opened.item}
        open={opened.open}
        onClose={opened.close}
        linkProfile={false}
      />
    </section>
  );
}

/** An entry's key: its part and its id, so no two parts' rows share one. */
function keyOf(entry: TimelineEntry): string {
  if ("visit" in entry) return `visit-${entry.visit.id}`;
  if ("appointment" in entry) return `appointment-${entry.appointment.id}`;
  return "bill" in entry ? `bill-${entry.bill.id}` : `payment-${entry.payment.id}`;
}

/** An entry as its part draws it. */
function EntryRow({
  entry,
  onOpen,
  onOpenPayment,
}: {
  entry: TimelineEntry;
  onOpen: (appointment: CalendarAppointment) => void;
  onOpenPayment: (payment: Payment) => void;
}) {
  if ("visit" in entry) return <VisitRow visit={entry.visit} />;
  if ("appointment" in entry) return <AppointmentRow appointment={entry.appointment} onOpen={onOpen} />;
  if ("bill" in entry) return <BillRow bill={entry.bill} />;
  return <PaymentRow payment={entry.payment} onOpen={onOpenPayment} />;
}

/**
 * A visit (D226): its day and doctor, the diagnosis — or the complaint — and
 * its medicines by name, or "Nothing recorded"; under them, the treatments
 * it worked on or began (D262); opening its screen, which leads back here
 * (D227, D230).
 */
function VisitRow({ visit }: { visit: PatientVisit }) {
  const named = visit.medicines.slice(0, HISTORY_MEDICINES_NAMED);
  const worked = visit.treatments.slice(0, HISTORY_TREATMENTS_NAMED);
  return (
    <Row
      title={patients.visitOn(formatDate(visit.day))}
      subtitle={[
        visit.doctorName ?? words.formerDoctor,
        visit.finding ?? (visit.recorded ? null : patients.nothingRecorded),
      ]
        .filter(Boolean)
        .join(" · ")}
      note={[
        named.length > 0 && patients.medicines(named, visit.medicines.length - named.length),
        worked.length > 0 && UI_TEXT.treatments.worked(worked, visit.treatments.length - worked.length),
      ]}
      detail={<StatusPill label={VISIT_STATUS_LABELS[visit.status]} tone={VISIT_STATUS_TONES[visit.status]} />}
      href={visitRoute(visit.id, VISIT_FROM.patient)}
    />
  );
}

/** An appointment with no visit (D167): quiet once it is no longer in play. */
function AppointmentRow({
  appointment,
  onOpen,
}: {
  appointment: PatientAppointment;
  onOpen: (appointment: CalendarAppointment) => void;
}) {
  return (
    <Row
      look={isLive(appointment.status) ? "surface" : "quiet"}
      title={words.when(formatDate(appointment.day), formatTime(appointment.scheduledAt))}
      subtitle={[appointment.doctorName ?? words.formerDoctor, kindOf(appointment), appointment.cancelReason]
        .filter(Boolean)
        .join(" · ")}
      detail={
        <StatusPill
          label={APPOINTMENT_STATUS_LABELS[appointment.status]}
          tone={APPOINTMENT_STATUS_TONES[appointment.status]}
        />
      }
      onClick={() => onOpen(appointment)}
    />
  );
}

/**
 * A bill (D325): "Bill 2026-27/0042", its day and total, and where it stands
 * — Paid, Part paid, Unpaid, or Void, quiet; opening its page, whose back
 * arrow returns here.
 */
function BillRow({ bill }: { bill: PatientBill }) {
  return (
    <Row
      look={bill.state === "VOID" ? "quiet" : "surface"}
      title={UI_TEXT.bill.titleOf(bill.number)}
      subtitle={[formatDate(dayKey(bill.issuedAt)), formatPaise(bill.totalPaise)].join(" · ")}
      detail={<StatusPill label={BILL_LIST_STATE_LABELS[bill.state]} tone={BILL_LIST_STATE_TONES[bill.state]} />}
      href={billRoute(bill.id, BILL_FROM.patient)}
    />
  );
}

/**
 * A payment or a refund (D325, D336): "Paid ₹500 · UPI", its day and who
 * took it — a refund marked so, a void one quiet — opening its sheet.
 */
function PaymentRow({ payment, onOpen }: { payment: Payment; onOpen: (payment: Payment) => void }) {
  return (
    <Row
      look={payment.void ? "quiet" : "surface"}
      title={paymentLine(payment)}
      subtitle={[formatDate(payment.paidOn), payment.receivedBy].filter(Boolean).join(" · ")}
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
