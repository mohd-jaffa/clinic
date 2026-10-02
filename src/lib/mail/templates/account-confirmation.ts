import { EMAIL_LINK_VALID_HOURS } from "@/constants/limits";
import { MAIL_TEXT } from "@/constants/messages";

import { emailHtml, emailText, type EmailParts } from "./layout";

export interface AccountConfirmationInput {
  appUrl: string;
  name: string;
  confirmationUrl: string;
}

/** A new owner's email, to confirm the address the clinic was signed up with (plan §5.1). */
export function accountConfirmationTemplate(input: AccountConfirmationInput) {
  const text = MAIL_TEXT.confirmation;
  const parts: EmailParts = {
    appUrl: input.appUrl,
    subject: text.subject,
    preheader: text.preheader,
    heading: text.heading,
    paragraphs: [MAIL_TEXT.greeting(input.name), text.body],
    action: { label: text.action, url: input.confirmationUrl, fallback: MAIL_TEXT.linkFallback },
    note: MAIL_TEXT.linkValid(EMAIL_LINK_VALID_HOURS),
    footnote: text.footnote,
  };
  return { subject: text.subject, text: emailText(parts), html: emailHtml(parts) };
}
