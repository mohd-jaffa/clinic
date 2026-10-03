import { describe, expect, it, vi } from "vitest";

import { MAIL_TEXT } from "@/constants/messages";
import { MailService } from "@/lib/mail/mail.service";

function service() {
  const send = vi.fn(async () => undefined);
  return {
    send,
    mail: new MailService({ provider: { send }, from: "Desk <no-reply@x.test>", appUrl: "https://x.test" }),
  };
}

describe("MailService", () => {
  it("sends the account confirmation from the app's sender to the owner", async () => {
    const { send, mail } = service();
    await mail.sendAccountConfirmation({ to: "asha@example.com", name: "Asha", confirmationUrl: "https://x.test/c" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Desk <no-reply@x.test>",
        to: "asha@example.com",
        subject: MAIL_TEXT.confirmation.subject,
        text: expect.stringContaining("https://x.test/c"),
        html: expect.stringContaining('href="https://x.test/c"'),
      }),
    );
  });

  it("sends an invite to join a clinic", async () => {
    const { send, mail } = service();
    await mail.sendInvite({
      to: "meera@example.com",
      name: "Meera",
      inviterName: "Asha Menon",
      clinicName: "Smile Care",
      role: "STAFF",
      inviteUrl: "https://x.test/accept-invite?token=t",
      validDays: 7,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "meera@example.com",
        subject: "You're invited to Smile Care on ClinicDesk",
        html: expect.stringContaining('href="https://x.test/accept-invite?token=t"'),
      }),
    );
  });

  it("sends the password reset link", async () => {
    const { send, mail } = service();
    await mail.sendPasswordReset({ to: "asha@example.com", name: "Asha", resetUrl: "https://x.test/r" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: MAIL_TEXT.passwordReset.subject,
        text: expect.stringContaining("https://x.test/r"),
      }),
    );
  });

  it("lets a provider's failure through, for the caller to report", async () => {
    const { send, mail } = service();
    send.mockImplementation(async () => {
      throw new Error("smtp down");
    });
    await expect(mail.sendPasswordReset({ to: "a@b.co", name: "A", resetUrl: "https://x.test/r" })).rejects.toThrow(
      "smtp down",
    );
  });
});
