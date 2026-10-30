import { describe, expect, it } from "vitest";

import { planExtendedTemplate, type PlanExtendedInput } from "@/lib/mail/templates/plan-extended";

/** A month paid for by UPI, with its receipt. */
const month: PlanExtendedInput = {
  appUrl: "https://clinicdesk.test",
  name: "Asha",
  clinicName: "Smile Care",
  kind: "MONTHLY",
  validFrom: "2026-11-12",
  validUntil: "2026-12-12",
  amountPaise: 30_000,
  method: "UPI",
  paidOn: "2026-10-30",
  receiptNumber: "R/2026-27/0001",
  reason: null,
  planUrl: "https://clinicdesk.test/settings/plan",
};

describe("planExtendedTemplate (plan §22; D375)", () => {
  it("says the new last day, what was paid, how and when, its receipt, and leads to the Plan screen", () => {
    const mail = planExtendedTemplate(month);
    expect(mail.subject).toBe("Smile Care's plan runs until 12 Dec 2026");
    expect(mail.html).toContain("Your plan is extended");
    expect(mail.text).toContain("Hi Asha,");
    expect(mail.text).toContain("Smile Care's plan now runs until 12 Dec 2026.");
    expect(mail.text).toContain("Monthly · ₹300 paid by UPI on 30 Oct 2026");
    expect(mail.text).toContain("Receipt R/2026-27/0001");
    expect(mail.text).toContain("See your plan: https://clinicdesk.test/settings/plan");
    expect(mail.text).toContain("You're getting this because you own Smile Care on ClinicDesk");
  });

  it("says a date set free is no charge, with the reason given, and has no receipt", () => {
    const mail = planExtendedTemplate({
      ...month,
      kind: "CUSTOM",
      validUntil: "2026-11-22",
      amountPaise: 0,
      method: null,
      paidOn: null,
      receiptNumber: null,
      reason: "Ten days for the move",
    });
    expect(mail.text).toContain("Set date · No charge · Ten days for the move");
    expect(mail.text).not.toContain("Receipt");
    expect(mail.html).toContain("Your plan is extended");
  });

  it("says the last day has changed when it was moved earlier, to correct it", () => {
    const mail = planExtendedTemplate({
      ...month,
      kind: "CUSTOM",
      validUntil: "2026-11-01",
      amountPaise: 0,
      method: null,
      paidOn: null,
      receiptNumber: null,
      reason: "Recorded a year by mistake",
    });
    expect(mail.subject).toBe("Smile Care's plan runs until 1 Nov 2026");
    expect(mail.html).toContain("Your plan&#39;s last day has changed");
  });
});
