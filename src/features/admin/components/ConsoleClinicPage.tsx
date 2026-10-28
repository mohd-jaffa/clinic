"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { useId } from "react";

import { LinkButton } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { DetailList } from "@/components/ui/detail-list";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { CONSOLE_CLINICS_ROUTE } from "@/constants/navigation";
import {
  CLINIC_TYPE_LABELS,
  EXTENSION_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  SUBSCRIPTION_PLAN_LABELS,
} from "@/constants/statuses";
import { formatPaise } from "@/lib/format/currency";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { mailtoHref } from "@/lib/mail/mailto";
import { callHref, formatPhoneDigits, whatsAppHref } from "@/lib/phone";

import { useConsoleClinic } from "../hooks/useConsoleClinic";
import type { ConsoleClinicDetail, ConsolePlanPayment } from "../types";
import { ClinicPills } from "./ClinicPills";

const { console: words } = UI_TEXT;

/**
 * A clinic's page in the console — `/admin/clinics/[id]` (plan §20.3;
 * D370): never its data, only what the Clinics list knows of it. The land
 * names it, its kind and city. On the ground: its **Plan** — the plan, its
 * last day, where it stands and No trial, when it signed up and how many
 * members it has — then its **Owner**, with Call, WhatsApp and Email to
 * reach them; beside them on a desktop, every change recorded to its plan.
 */
export function ConsoleClinicPage({ clinicId }: { clinicId: string }) {
  const query = useConsoleClinic(clinicId);
  const clinic = query.data;

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader
            title={clinic?.name ?? words.clinic}
            subtitle={clinic && `${CLINIC_TYPE_LABELS[clinic.type]} · ${clinic.city}`}
            back={CONSOLE_CLINICS_ROUTE}
          />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        {clinic ? (
          <div className="grid max-w-6xl grid-cols-1 items-start gap-8 lg:grid-cols-2">
            <div className="grid grid-cols-1 gap-8">
              <PlanSection clinic={clinic} />
              <OwnerSection clinic={clinic} />
            </div>
            <PlanHistory payments={clinic.payments} />
          </div>
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed="CONSOLE_CLINIC_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={4} />
          </section>
        )}
      </div>
    </>
  );
}

function PlanSection({ clinic }: { clinic: ConsoleClinicDetail }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={words.plan} />
      <DetailList
        details={[
          { label: words.planLabel, value: SUBSCRIPTION_PLAN_LABELS[clinic.plan] },
          { label: words.validUntilLabel, value: formatDate(clinic.validUntil) },
          { label: words.stateLabel, value: <ClinicPills clinic={clinic} /> },
          { label: words.signedUpLabel, value: formatDateTime(clinic.signedUpAt) },
          { label: words.membersLabel, value: String(clinic.members) },
        ]}
      />
    </section>
  );
}

/** The owner, and Call, WhatsApp and Email to reach them about their plan (D370) — the chat and the email left empty. */
function OwnerSection({ clinic: { owner } }: { clinic: ConsoleClinicDetail }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={words.owner} />
      <div className="grid gap-4">
        <DetailList
          details={[
            { label: words.nameLabel, value: owner.name },
            {
              label: words.mobileLabel,
              value: owner.phone ? `${UI_TEXT.fields.phonePrefix} ${formatPhoneDigits(owner.phone)}` : words.noMobile,
            },
            { label: words.emailLabel, value: owner.email },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {owner.phone && (
            <>
              <LinkButton
                href={callHref(owner.phone)}
                label={words.call}
                accessibleName={words.callTo(owner.name)}
                icon={Phone}
                size="sm"
              />
              <LinkButton
                href={whatsAppHref(owner.phone)}
                label={words.whatsApp}
                accessibleName={words.whatsAppTo(owner.name)}
                icon={MessageCircle}
                variant="secondary"
                size="sm"
                newTab
              />
            </>
          )}
          <LinkButton
            href={mailtoHref(owner.email)}
            label={words.email}
            accessibleName={words.emailTo(owner.name)}
            icon={Mail}
            variant="secondary"
            size="sm"
          />
        </div>
      </div>
    </section>
  );
}

/** How it was paid and its receipt — or, at no charge, the reason given — under what it was. */
const lineOf = (payment: ConsolePlanPayment) =>
  [
    EXTENSION_KIND_LABELS[payment.kind],
    payment.paidOn && UI_TEXT.plan.paidOn(formatDate(payment.paidOn)),
    payment.method && PAYMENT_METHOD_LABELS[payment.method],
    payment.reference,
    payment.receiptNumber && words.receipt(payment.receiptNumber),
    payment.reason,
  ]
    .filter(Boolean)
    .join(" · ");

/** Every change recorded to the clinic's plan, the latest first: the day it runs to, how, and who recorded it when. */
function PlanHistory({ payments }: { payments: ConsolePlanPayment[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={words.planHistory} />
      {payments.length === 0 ? (
        <p className="text-small text-muted">{words.noPlanHistory}</p>
      ) : (
        <RowList label={words.planHistory}>
          {payments.map((payment) => (
            <Row
              key={payment.id}
              title={UI_TEXT.plan.until(formatDate(payment.validUntil))}
              subtitle={lineOf(payment)}
              note={words.byWhom(payment.recordedBy ?? words.someone, formatDateTime(payment.recordedAt))}
              detail={payment.amountPaise > 0 ? formatPaise(payment.amountPaise) : UI_TEXT.plan.noCharge}
              wrap
            />
          ))}
        </RowList>
      )}
    </section>
  );
}
