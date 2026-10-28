"use client";

import { Copy, Mail, MessageCircle, Phone } from "lucide-react";
import { useId } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { useResponse } from "@/components/ui/response-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { UI_TEXT } from "@/constants/messages";
import { SUBSCRIPTION_PLAN_LABELS } from "@/constants/statuses";
import { formatPaise } from "@/lib/format/currency";
import { mailtoHref } from "@/lib/mail/mailto";
import { callHref, formatPhoneDigits, whatsAppHref } from "@/lib/phone";

import type { PlanView } from "../types";

const { plan: words } = UI_TEXT;

/**
 * The UPI id, and **Copy** (D364): the owner pays from their own UPI app,
 * then says so. The card says whether it was copied.
 */
function UpiId({ id }: { id: string }) {
  const respond = useResponse();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      respond.success({ title: words.upiCopied, message: words.upiCopiedBody });
    } catch {
      respond.error({ title: words.upiNotCopied, message: words.upiNotCopiedBody });
    }
  };
  return (
    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="break-all">{id}</span>
      <Button
        label={words.copy}
        aria-label={words.copyUpi}
        icon={Copy}
        variant="secondary"
        size="sm"
        onClick={() => void copy()}
      />
    </span>
  );
}

/**
 * How to renew (plan §6, §7.5; D364, D365): the Monthly and Yearly prices
 * from the live settings, then the renewal contact — each part only once the
 * DEV has set it — with Call, WhatsApp and Email. WhatsApp and the email
 * open with the words already typed and the clinic named, which the owner
 * may change before sending.
 */
export function HowToRenew({ plan, clinicName }: { plan: PlanView; clinicName: string }) {
  const id = useId();
  const { name, phone, email, upiId } = plan.contact;
  const message = words.renewalMessage(clinicName);
  const to = (named: (name: string) => string) => (name ? named(name) : undefined);
  const details: Detail[] = [
    ...(name ? [{ label: words.contactName, value: name }] : []),
    ...(phone
      ? [{ label: words.contactPhone, value: `${UI_TEXT.fields.phonePrefix} ${formatPhoneDigits(phone)}` }]
      : []),
    ...(email ? [{ label: words.contactEmail, value: email }] : []),
    ...(upiId ? [{ label: words.upiId, value: <UpiId id={upiId} /> }] : []),
  ];

  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={words.howToRenew} />
      <div className="grid gap-4">
        <p className="text-small text-muted">{words.renewIntro}</p>
        <StatGrid>
          <StatTile label={SUBSCRIPTION_PLAN_LABELS.MONTHLY} value={formatPaise(plan.prices.monthlyPaise)} />
          <StatTile label={SUBSCRIPTION_PLAN_LABELS.YEARLY} value={formatPaise(plan.prices.yearlyPaise)} />
        </StatGrid>
        {details.length > 0 && <DetailList details={details} />}
        {(phone || email) && (
          <div className="flex flex-wrap gap-2">
            {phone && (
              <>
                <LinkButton
                  href={callHref(phone)}
                  label={words.call}
                  accessibleName={to(words.callTo)}
                  icon={Phone}
                  size="sm"
                />
                <LinkButton
                  href={whatsAppHref(phone, message)}
                  label={words.whatsApp}
                  accessibleName={to(words.whatsAppTo)}
                  icon={MessageCircle}
                  variant="secondary"
                  size="sm"
                  newTab
                />
              </>
            )}
            {email && (
              <LinkButton
                href={mailtoHref(email, { subject: words.renewalSubject(clinicName), body: message })}
                label={words.email}
                accessibleName={to(words.emailTo)}
                icon={Mail}
                variant="secondary"
                size="sm"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
