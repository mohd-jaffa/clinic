import { MAIL_TEXT } from "@/constants/messages";

import { emailHtml, emailText, type EmailParts } from "./layout";

export interface InviteInput {
  appUrl: string;
  name: string;
  inviterName: string;
  clinicName: string;
  role: "DOCTOR" | "STAFF";
  inviteUrl: string;
  /** How long the link lasts: the platform's `invite_valid_days`. */
  validDays: number;
}

/** An invite to join a clinic's team (plan §8.4, §22): its link is the only place the token goes (D90). */
export function inviteTemplate(input: InviteInput) {
  const text = MAIL_TEXT.invite;
  const subject = text.subject(input.clinicName);
  const parts: EmailParts = {
    appUrl: input.appUrl,
    subject,
    preheader: text.preheader,
    heading: text.heading(input.clinicName),
    paragraphs: [
      MAIL_TEXT.greeting(input.name),
      text.body(input.inviterName, input.clinicName, text.roles[input.role]),
    ],
    action: { label: text.action, url: input.inviteUrl, fallback: MAIL_TEXT.linkFallback },
    note: text.linkValid(input.validDays),
    footnote: text.footnote,
  };
  return { subject, text: emailText(parts), html: emailHtml(parts) };
}
