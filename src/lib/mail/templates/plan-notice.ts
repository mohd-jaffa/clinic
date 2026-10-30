import type { PlatformSettings } from "@/constants/platform";
import { MAIL_TEXT } from "@/constants/messages";
import type { PlanNotice } from "@/constants/statuses";
import { dayCount } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { formatDate, formatDayMonth } from "@/lib/format/date";
import { formatPhoneDigits } from "@/lib/phone";

import { emailHtml, emailText, type EmailParts } from "./layout";

export interface PlanNoticeInput {
  appUrl: string;
  /** The owner. */
  name: string;
  clinicName: string;
  notice: PlanNotice;
  /** Still on the free trial: called one. */
  trial: boolean;
  /** The plan's last day, the clinic's today, and its first view-only day. */
  validUntil: string;
  today: string;
  readOnlyFrom: string;
  /** How to renew, from the live settings: the prices, and whatever of the contact is set. */
  renewal: Pick<
    PlatformSettings,
    | "monthlyPricePaise"
    | "yearlyPricePaise"
    | "renewalContactName"
    | "renewalContactPhone"
    | "renewalContactEmail"
    | "renewalUpiId"
  >;
  /** The owner's Plan screen. */
  planUrl: string;
}

/** How to renew (D384): the two prices, then the contact and the UPI id, each only if set. */
function renewalLines({ renewal }: PlanNoticeInput): string[] {
  const text = MAIL_TEXT.planNotice;
  const ways = [
    renewal.renewalContactPhone && `+91 ${formatPhoneDigits(renewal.renewalContactPhone)}`,
    renewal.renewalContactEmail,
  ]
    .filter(Boolean)
    .join(" · ");
  return [
    text.prices(formatPaise(renewal.monthlyPricePaise), formatPaise(renewal.yearlyPricePaise)),
    ...(ways || renewal.renewalContactName ? [text.contact(renewal.renewalContactName, ways)] : []),
    ...(renewal.renewalUpiId ? [text.upi(renewal.renewalUpiId)] : []),
  ];
}

/** What each notice says first: its subject, heading and the line with its key date. */
function opening(input: PlanNoticeInput) {
  const text = MAIL_TEXT.planNotice;
  const plan = text.plan(input.trial);
  const lastDay = formatDate(input.validUntil);
  if (input.notice === "ENDS_SOON") {
    return {
      subject: text.endsSoon.subject(input.clinicName, plan, formatDayMonth(input.validUntil)),
      heading: text.endsSoon.heading(plan, dayCount(input.today, input.validUntil) - 1),
      body: text.endsSoon.body(input.clinicName, plan, lastDay),
    };
  }
  if (input.notice === "ENDED") {
    return {
      subject: text.ended.subject(input.clinicName, plan),
      heading: text.ended.heading(plan),
      body: text.ended.body(input.clinicName, plan, lastDay, formatDate(input.readOnlyFrom)),
    };
  }
  return {
    subject: text.readOnly.subject(input.clinicName),
    heading: text.readOnly.heading,
    body: text.readOnly.body(input.clinicName, plan, lastDay),
  };
}

/**
 * A daily plan email (plan §22; D384): the plan ends soon, has ended, or the
 * clinic is now view-only — the key date first, then how to renew, and the
 * owner's Plan screen.
 */
export function planNoticeTemplate(input: PlanNoticeInput) {
  const text = MAIL_TEXT.planNotice;
  const { subject, heading, body } = opening(input);
  const parts: EmailParts = {
    appUrl: input.appUrl,
    subject,
    preheader: text.preheader,
    heading,
    paragraphs: [MAIL_TEXT.greeting(input.name), body, ...renewalLines(input)],
    action: { label: text.action, url: input.planUrl, fallback: MAIL_TEXT.linkFallback },
    footnote: text.footnote(input.clinicName),
  };
  return { subject, text: emailText(parts), html: emailHtml(parts) };
}
