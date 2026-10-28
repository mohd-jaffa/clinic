import { describe, expect, it } from "vitest";

import { describeAudit } from "@/features/admin/describe";
import type { ConsoleAuditEntry } from "@/features/admin/types";

const entry = (overrides: Partial<ConsoleAuditEntry>): ConsoleAuditEntry => ({
  id: "a-1",
  action: "UPDATE",
  entityType: "platform_settings",
  changes: null,
  requestId: null,
  actorName: "Jaffa",
  clinicName: null,
  at: "2026-10-28T05:00:00.000Z",
  ...overrides,
});

describe("describeAudit (plan §20.7)", () => {
  it("says a plan was extended: for which clinic, its last day from and to, and what was paid", () => {
    const changes = {
      clinic_id: "c-1",
      kind: "MONTHLY",
      plan: { from: "TRIAL", to: "MONTHLY" },
      valid_until: { from: "2026-11-12", to: "2026-12-12" },
      amount_paise: 30_000,
    };
    expect(
      describeAudit(
        entry({ action: "CREATE", entityType: "subscription_payments", clinicName: "Smile Care", changes }),
      ),
    ).toEqual({ title: "Plan extended · Smile Care", line: "Monthly · 12 Nov 2026 → 12 Dec 2026 · ₹300" });
    expect(
      describeAudit(
        entry({
          action: "CREATE",
          entityType: "subscription_payments",
          changes: { ...changes, kind: "CUSTOM", amount_paise: 0 },
        }),
      ),
    ).toEqual({
      title: "Plan extended · A clinic no longer here",
      line: "Set date · 12 Nov 2026 → 12 Dec 2026 · No charge",
    });
  });

  it("says each setting changed by name, from and to: prices in rupees, days as a list, nothing as a dash", () => {
    expect(
      describeAudit(
        entry({
          changes: {
            trial_days: { from: 30, to: 45 },
            monthly_price_paise: { from: 30_000, to: 35_000 },
            expiry_notice_days: { from: [7, 1], to: [10, 3, 1] },
            renewal_contact_name: { from: null, to: "Jaffa" },
          },
        }),
      ),
    ).toEqual({
      title: "Settings changed",
      line: "Trial days 30 → 45 · Monthly price ₹300 → ₹350 · Expiry email days 7, 1 → 10, 3, 1 · Renewal contact — → Jaffa",
    });
  });

  it("names anything else by its record and action", () => {
    expect(describeAudit(entry({ entityType: "clinics", action: "DELETE" }))).toEqual({ title: "clinics · DELETE" });
  });
});
