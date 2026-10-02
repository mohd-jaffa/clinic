import { EMAIL_LINK_VALID_HOURS } from "@/constants/limits";
import { MAIL_TEXT } from "@/constants/messages";

import { emailHtml, emailText, type EmailParts } from "./layout";

export interface PasswordResetInput {
  appUrl: string;
  name: string;
  resetUrl: string;
}

/** The link that lets a person choose a new password (plan §5.3). */
export function passwordResetTemplate(input: PasswordResetInput) {
  const text = MAIL_TEXT.passwordReset;
  const parts: EmailParts = {
    appUrl: input.appUrl,
    subject: text.subject,
    preheader: text.preheader,
    heading: text.heading,
    paragraphs: [MAIL_TEXT.greeting(input.name), text.body],
    action: { label: text.action, url: input.resetUrl, fallback: MAIL_TEXT.linkFallback },
    note: MAIL_TEXT.linkValid(EMAIL_LINK_VALID_HOURS),
    footnote: text.footnote,
  };
  return { subject: text.subject, text: emailText(parts), html: emailHtml(parts) };
}
