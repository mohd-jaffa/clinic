"use client";

import { useId, type ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Row, RowList, RowToken } from "@/components/ui/row";
import { SectionHeading, type ViewAll } from "@/components/ui/section-heading";
import { UI_TEXT } from "@/constants/messages";
import {
  APPOINTMENTS_ROUTE,
  BILLING_ROUTE,
  EXPENSES_ROUTE,
  FOLLOW_UPS_ROUTE,
  patientRoute,
  QUEUE_ROUTE,
} from "@/constants/navigation";
import { PAYMENT_METHOD_LABELS } from "@/constants/statuses";
import { tokenNumeral } from "@/features/appointments/components/QueueRows";
import { UrgentTag } from "@/features/appointments/components/UrgentTag";
import { OwingPill } from "@/features/billing/components/OwingPill";
import { paymentLine } from "@/features/billing/describe";
import { followUpAbout } from "@/features/treatments/describe";
import { formatPaise } from "@/lib/format/currency";
import { formatNearDate, formatRecent, formatTime } from "@/lib/format/date";

import type { Dashboard, HomeQueueDoctor } from "../types";

const { home: words, patients, billing, appointment } = UI_TEXT;

/**
 * Home's sections (plan §17, §32.1; D349, D351): the queue in miniature, To
 * bill, the follow-ups due today, tomorrow, who owes most, the last payments
 * and the last expenses — each only when the person's permissions open it,
 * in that order, two to a row on a desktop. A row opens the patient's
 * profile (an expense, Expenses); each section's link opens its own screen.
 */
export function HomeSections({ home }: { home: Dashboard }) {
  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
      {home.queue && <QueueSection queue={home.queue} />}
      {home.toBill && (
        <HomeSection
          title={words.toBill.title}
          count={home.toBill.count}
          viewAll={{ label: words.toBill.open, name: words.toBill.openName, href: BILLING_ROUTE }}
          empty={words.toBill.empty}
        >
          {home.toBill.visits.map((visit) => (
            <Row
              key={visit.visitId}
              leading={<Avatar name={visit.patient.name} />}
              title={visit.patient.name}
              subtitle={[
                patients.number(visit.patient.number),
                visit.doctorName ?? appointment.formerDoctor,
                visit.token !== null && billing.token(visit.token),
              ]
                .filter(Boolean)
                .join(" · ")}
              href={patientRoute(visit.patient.id)}
            />
          ))}
        </HomeSection>
      )}
      {home.followUps && (
        <HomeSection
          title={words.followUps.title}
          count={home.followUps.today}
          viewAll={{ label: UI_TEXT.actions.viewAll, name: words.followUps.openName, href: FOLLOW_UPS_ROUTE }}
          empty={words.followUps.empty}
          note={[
            home.followUps.overdue > 0 && words.followUps.overdue(home.followUps.overdue),
            home.followUps.lapsed > 0 && words.followUps.lapsed(home.followUps.lapsed),
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {home.followUps.due.map((followUp) => (
            <Row
              key={followUp.id}
              leading={<Avatar name={followUp.patient.name} />}
              title={followUp.patient.name}
              subtitle={followUpAbout(followUp)}
              href={patientRoute(followUp.patient.id)}
            />
          ))}
        </HomeSection>
      )}
      {home.upcoming && (
        <HomeSection
          title={words.upcoming.title}
          count={home.upcoming.count}
          viewAll={{ label: words.upcoming.open, href: APPOINTMENTS_ROUTE }}
          empty={words.upcoming.empty}
        >
          {home.upcoming.appointments.map((booked) => (
            <Row
              key={booked.id}
              leading={<RowToken value={formatTime(booked.scheduledAt)} label={words.upcoming.at} />}
              title={booked.patient.name}
              subtitle={`${booked.typeName} · ${booked.doctorName}`}
              href={patientRoute(booked.patient.id)}
            />
          ))}
        </HomeSection>
      )}
      {home.owing && (
        <HomeSection
          title={words.owing.title}
          viewAll={{ label: words.owing.open, name: words.owing.openName, href: BILLING_ROUTE }}
          empty={words.owing.empty}
        >
          {home.owing.map((owed) => (
            <Row
              key={owed.patient.id}
              leading={<Avatar name={owed.patient.name} />}
              title={owed.patient.name}
              subtitle={patients.number(owed.patient.number)}
              detail={<OwingPill balancePaise={owed.balancePaise} />}
              href={patientRoute(owed.patient.id)}
            />
          ))}
        </HomeSection>
      )}
      {home.payments && (
        <HomeSection
          title={words.payments.title}
          viewAll={{ label: words.payments.open, name: words.payments.openName, href: BILLING_ROUTE }}
          empty={words.payments.empty}
        >
          {home.payments.map((payment) => (
            <Row
              key={payment.id}
              title={payment.patient.name}
              subtitle={paymentLine(payment)}
              note={formatRecent(payment.paidAt)}
              href={patientRoute(payment.patient.id)}
            />
          ))}
        </HomeSection>
      )}
      {home.expenses && (
        <HomeSection
          title={words.expenses.title}
          viewAll={{ label: words.expenses.open, href: EXPENSES_ROUTE }}
          empty={words.expenses.empty}
        >
          {home.expenses.map((expense) => (
            <Row
              key={expense.id}
              title={expense.categoryName}
              subtitle={[expense.description, PAYMENT_METHOD_LABELS[expense.method], formatNearDate(expense.day)]
                .filter(Boolean)
                .join(" · ")}
              detail={formatPaise(expense.amountPaise)}
              href={EXPENSES_ROUTE}
            />
          ))}
        </HomeSection>
      )}
    </div>
  );
}

/**
 * Today's queue in miniature (plan §17, §32.1; D349): how many wait in all;
 * for each doctor with anyone in or waiting — a doctor only themselves —
 * how many are in and how many wait, and the next three by token.
 */
function QueueSection({ queue }: { queue: HomeQueueDoctor[] }) {
  return (
    <HomeSection
      title={words.queue.title}
      count={queue.reduce((sum, doctor) => sum + doctor.waiting, 0)}
      viewAll={{ label: words.queue.open, href: QUEUE_ROUTE }}
      empty={words.queue.empty}
      list={false}
    >
      {queue.length > 0 && (
        <div className="grid gap-4">
          {queue.map((doctor) => (
            <div key={doctor.doctorId} className="grid gap-2">
              <h3 className="text-small font-bold text-ink">
                {doctor.doctorName}
                <span className="font-normal text-muted">
                  {` · ${words.queue.doctorLine(doctor.withDoctor, doctor.waiting)}`}
                </span>
              </h3>
              {doctor.next.length > 0 && (
                <RowList label={words.queue.waitingFor(doctor.doctorName)}>
                  {doctor.next.map((waiting) => (
                    <Row
                      key={waiting.appointmentId}
                      leading={<RowToken value={tokenNumeral(waiting.token)} label={UI_TEXT.queue.token} />}
                      title={waiting.patient.name}
                      subtitle={patients.number(waiting.patient.number)}
                      detail={waiting.urgent && <UrgentTag />}
                      href={patientRoute(waiting.patient.id)}
                    />
                  ))}
                </RowList>
              )}
            </div>
          ))}
        </div>
      )}
    </HomeSection>
  );
}

/**
 * One of Home's sections: its heading with how many it holds and its link,
 * any coral note under it ("2 overdue"), then its rows — or a quiet line
 * when it holds none. `list` false: the children are drawn as they are.
 */
function HomeSection({
  title,
  count,
  viewAll,
  empty,
  note,
  list = true,
  children,
}: {
  title: string;
  count?: number;
  viewAll: ViewAll;
  empty: string;
  note?: string;
  list?: boolean;
  children: ReactNode[] | ReactNode;
}) {
  const id = useId();
  const rows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section aria-labelledby={id} className="min-w-0">
      <SectionHeading id={id} title={title} count={count} viewAll={viewAll} />
      {note && <p className="mb-2 text-small font-bold text-coral">{note}</p>}
      {!rows ? (
        <p className="text-small text-muted">{empty}</p>
      ) : list ? (
        <RowList label={title}>{children}</RowList>
      ) : (
        children
      )}
    </section>
  );
}
