import { describe, expect, it } from "vitest";

import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { planNoticeTemplate, type PlanNoticeInput } from "@/lib/mail/templates/plan-notice";

/** A monthly plan ending on 12 Nov, told 7 days before, with the whole renewal contact set. */
const notice: PlanNoticeInput = {
  appUrl: "https://clinicdesk.test",
  name: "Asha",
  clinicName: "Smile Care",
  notice: "ENDS_SOON",
  trial: false,
  validUntil: "2026-11-12",
  today: "2026-11-05",
  readOnlyFrom: "2026-11-20",
  renewal: {
    ...PLATFORM_SETTING_DEFAULTS,
    renewalContactName: "Jaffa",
    renewalContactPhone: "+919845012345",
    renewalContactEmail: "renew@clinicdesk.in",
    renewalUpiId: "clinicdesk@okaxis",
  },
  planUrl: "https://clinicdesk.test/settings/plan",
};

describe("planNoticeTemplate (plan §22; D384)", () => {
  it("says when the plan ends, how to renew, and leads to the Plan screen", () => {
    const mail = planNoticeTemplate(notice);
    expect(mail.subject).toBe("Smile Care's plan ends on 12 Nov");
    expect(mail.html).toContain("Your plan ends in 7 days");
    expect(mail.text).toContain("Hi Asha,");
    expect(mail.text).toContain(
      "Smile Care's plan ends on 12 Nov 2026. Renew before then to keep working without a break.",
    );
    expect(mail.text).toContain("₹300 a month, or ₹3,000 a year.");
    expect(mail.text).toContain("To renew, contact Jaffa: +91 98450 12345 · renew@clinicdesk.in");
    expect(mail.text).toContain("UPI: clinicdesk@okaxis");
    expect(mail.text).toContain("See how to renew: https://clinicdesk.test/settings/plan");
    expect(mail.text).toContain("You're getting this because you own Smile Care on ClinicDesk.");
  });

  it("counts down to tomorrow and today, and calls a trial one", () => {
    expect(planNoticeTemplate({ ...notice, today: "2026-11-11" }).html).toContain("Your plan ends tomorrow");
    const trial = planNoticeTemplate({ ...notice, trial: true, today: "2026-11-12" });
    expect(trial.subject).toBe("Smile Care's free trial ends on 12 Nov");
    expect(trial.html).toContain("Your free trial ends today");
  });

  it("says the plan has ended, and the day the clinic becomes view-only", () => {
    const mail = planNoticeTemplate({ ...notice, notice: "ENDED", today: "2026-11-13" });
    expect(mail.subject).toBe("Smile Care's plan has ended");
    expect(mail.html).toContain("Your plan has ended");
    expect(mail.text).toContain(
      "Smile Care's plan ended on 12 Nov 2026. Everything still works until 20 Nov 2026, when the clinic becomes view-only.",
    );
  });

  it("says the clinic is view-only, and that everything is kept", () => {
    const mail = planNoticeTemplate({ ...notice, notice: "READ_ONLY", trial: true, today: "2026-11-20" });
    expect(mail.subject).toBe("Smile Care is now view-only");
    expect(mail.html).toContain("Your clinic is view-only");
    expect(mail.text).toContain("Smile Care's free trial ended on 12 Nov 2026, so the clinic is now view-only.");
    expect(mail.text).toContain("Everything is kept: you can still read, search and print.");
  });

  it("says only what of the renewal contact is set", () => {
    const unset = { ...PLATFORM_SETTING_DEFAULTS };
    const bare = planNoticeTemplate({ ...notice, renewal: unset });
    expect(bare.text).toContain("₹300 a month, or ₹3,000 a year.");
    expect(bare.text).not.toContain("To renew");
    expect(bare.text).not.toContain("UPI:");
    expect(planNoticeTemplate({ ...notice, renewal: { ...unset, renewalContactName: "Jaffa" } }).text).toContain(
      "To renew, contact Jaffa.",
    );
    expect(
      planNoticeTemplate({ ...notice, renewal: { ...unset, renewalContactEmail: "renew@clinicdesk.in" } }).text,
    ).toContain("To renew, contact us: renew@clinicdesk.in");
  });
});
