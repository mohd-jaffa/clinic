import { describe, expect, it } from "vitest";

import { EMAIL_LINK_VALID_HOURS } from "@/constants/limits";
import { MAIL_TEXT } from "@/constants/messages";
import { accountConfirmationTemplate } from "@/lib/mail/templates/account-confirmation";

describe("accountConfirmationTemplate", () => {
  it("greets the owner and carries the confirmation link, as a button and in words, in text and HTML", () => {
    const mail = accountConfirmationTemplate({
      appUrl: "https://clinicdesk.test",
      name: "Asha",
      confirmationUrl: "https://clinicdesk.test/confirm-email#t=1",
    });
    expect(mail.subject).toBe(MAIL_TEXT.confirmation.subject);
    expect(mail.text).toContain("Hi Asha,");
    expect(mail.text).toContain(MAIL_TEXT.confirmation.body);
    expect(mail.text).toContain(`${MAIL_TEXT.confirmation.action}: https://clinicdesk.test/confirm-email#t=1`);
    expect(mail.text).toContain(MAIL_TEXT.linkValid(EMAIL_LINK_VALID_HOURS));
    expect(mail.html).toContain('href="https://clinicdesk.test/confirm-email#t=1"');
    expect(mail.html).toContain(MAIL_TEXT.linkFallback.replace("'", "&#39;"));
    expect(mail.html).toContain(MAIL_TEXT.confirmation.heading);
  });
});
