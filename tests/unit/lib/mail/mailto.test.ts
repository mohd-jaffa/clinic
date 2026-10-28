import { describe, expect, it } from "vitest";

import { mailtoHref } from "@/lib/mail/mailto";

describe("mailtoHref (plan §22)", () => {
  it("opens the person's mail app to the address, the subject and the words typed", () => {
    expect(
      mailtoHref("renew@clinicdesk.in", { subject: "Renewing Smile & Care", body: "Hello, I’d like to renew." }),
    ).toBe(
      "mailto:renew@clinicdesk.in?subject=Renewing%20Smile%20%26%20Care&body=Hello%2C%20I%E2%80%99d%20like%20to%20renew.",
    );
  });
});
