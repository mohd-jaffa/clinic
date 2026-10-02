import { describe, expect, it } from "vitest";

import { EMAIL_LINK_VALID_HOURS } from "@/constants/limits";
import { MAIL_TEXT } from "@/constants/messages";
import { passwordResetTemplate } from "@/lib/mail/templates/password-reset";

describe("passwordResetTemplate", () => {
  it("carries the link to choose a new password, and how long it works", () => {
    const mail = passwordResetTemplate({
      appUrl: "https://clinicdesk.test/",
      name: "Asha",
      resetUrl: "https://clinicdesk.test/reset-password#t=1",
    });
    expect(mail.subject).toBe(MAIL_TEXT.passwordReset.subject);
    expect(mail.text).toContain("Hi Asha,");
    expect(mail.text).toContain(`${MAIL_TEXT.passwordReset.action}: https://clinicdesk.test/reset-password#t=1`);
    expect(mail.text).toContain(MAIL_TEXT.linkValid(EMAIL_LINK_VALID_HOURS));
    expect(mail.html).toContain('href="https://clinicdesk.test/reset-password#t=1"');
  });
});
