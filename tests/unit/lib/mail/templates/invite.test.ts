import { describe, expect, it } from "vitest";

import { inviteTemplate } from "@/lib/mail/templates/invite";

const invite = {
  appUrl: "https://clinicdesk.test",
  name: "Meera",
  inviterName: "Asha Menon",
  clinicName: "Smile Care",
  role: "STAFF" as const,
  inviteUrl: "https://clinicdesk.test/accept-invite?token=abc",
  validDays: 7,
};

describe("inviteTemplate (plan §8.4, §22)", () => {
  it("says who invited them, to which clinic, as what, with the link and how long it works", () => {
    const mail = inviteTemplate(invite);
    expect(mail.subject).toBe("You're invited to Smile Care on ClinicDesk");
    expect(mail.text).toContain("Hi Meera,");
    expect(mail.text).toContain("Asha Menon has invited you to join Smile Care on ClinicDesk, as a member of staff.");
    expect(mail.text).toContain("Accept the invite: https://clinicdesk.test/accept-invite?token=abc");
    expect(mail.text).toContain("The link works for 7 days.");
    expect(mail.html).toContain('href="https://clinicdesk.test/accept-invite?token=abc"');
  });

  it("names a doctor as one, and a single day as one", () => {
    const mail = inviteTemplate({ ...invite, role: "DOCTOR", validDays: 1 });
    expect(mail.text).toContain("as a doctor.");
    expect(mail.text).toContain("The link works for 1 day.");
  });
});
