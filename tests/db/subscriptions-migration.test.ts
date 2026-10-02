import { describe, expect, it } from "vitest";

import { MAX_AMOUNT_PAISE, TEXT_LIMITS } from "@/constants/limits";
import { EXTENSION_KINDS, PAYMENT_METHODS, SUBSCRIPTION_PLANS, SUBSCRIPTION_STATES } from "@/constants/statuses";
import { CLINIC_TIME_ZONE } from "@/lib/dates/calendar";
import {
  betweenBounds,
  checkedValues,
  cleanTextLimit,
  columnLine,
  functionBody,
  quoted,
  readMigration,
  tableBody,
} from "@tests/support/sql";

const sql = readMigration("0005_subscriptions.sql");
const payments = tableBody(sql, "subscription_payments");

describe("0005 the subscription", () => {
  it("knows the plans the app knows", () => {
    expect(checkedValues(tableBody(sql, "clinic_subscriptions"), "plan")).toEqual([...SUBSCRIPTION_PLANS]);
  });

  it("is one row per clinic, gone with it", () => {
    expect(columnLine(sql, "clinic_subscriptions", "clinic_id")).toContain(
      "uuid primary key references public.clinics (id) on delete cascade",
    );
  });
});

describe("0005 payments", () => {
  it("know the extension kinds and payment methods the app knows", () => {
    expect(checkedValues(payments, "plan")).toEqual([...EXTENSION_KINDS]);
    expect(checkedValues(payments, "method")).toEqual([...PAYMENT_METHODS]);
  });

  it("bound the amount, the reference and the reason as the forms do", () => {
    expect(betweenBounds(sql, "subscription_payments", "amount_paise")).toEqual({ min: 0, max: MAX_AMOUNT_PAISE });
    expect(cleanTextLimit(sql, "subscription_payments", "reference")).toBe(TEXT_LIMITS.reference);
    expect(cleanTextLimit(sql, "subscription_payments", "reason")).toBe(TEXT_LIMITS.reason);
  });

  it("need a reason for a date set by hand, and a receipt exactly when money was received (D58)", () => {
    expect(payments).toContain("check (plan <> 'CUSTOM' or reason is not null)");
    expect(payments).toContain("check (amount_paise = 0 or (method is not null and paid_on is not null))");
    expect(payments).toContain("check ((amount_paise > 0) = (receipt_number is not null))");
    expect(columnLine(sql, "subscription_payments", "receipt_number")).toContain(
      "text unique check (receipt_number ~ '^R/[0-9]{4}-[0-9]{2}/[0-9]{4,}$')",
    );
  });
});

describe("0005 trial claims (D42)", () => {
  it("keep an HMAC of the mobile, never the number, outliving the clinic", () => {
    const claims = tableBody(sql, "trial_claims");
    expect(claims).toContain("mobile_hmac text primary key check (mobile_hmac ~ '^[0-9a-f]{64}$')");
    expect(columnLine(sql, "trial_claims", "last_clinic_id").trim()).toBe("last_clinic_id uuid");
    expect(claims).not.toMatch(/references|phone|mobile text/);
  });
});

describe("0005 the state (plan §7.2)", () => {
  it("is one of the states the app knows, in the same order of days", () => {
    const rule = functionBody(sql, "subscription_state_for").split("as $$")[1];
    expect(quoted(rule)).toEqual([...SUBSCRIPTION_STATES]);
  });

  it("applies the rule with the clinic's today and the live settings, and no plan is read-only", () => {
    const state = functionBody(sql, "subscription_state");
    expect(state).toContain("(now() at time zone clinic.timezone)::date");
    expect(state).toContain("settings.expiry_warning_days");
    expect(state).toContain("settings.grace_days");
    expect(state).toContain("'READ_ONLY'\n  );");
  });

  it("refuses a write while read-only, with CLINIC_PLAN_EXPIRED", () => {
    expect(functionBody(sql, "clinic_can_write")).toContain("<> 'READ_ONLY'");
    expect(functionBody(sql, "require_clinic_write")).toContain("using hint = 'CLINIC_PLAN_EXPIRED'");
  });
});

describe("0005 who reads what", () => {
  it("lets only the owner read the plan and its payments, and no one signed in the counters or claims", () => {
    for (const table of ["clinic_subscriptions", "subscription_payments", "receipt_counters", "trial_claims"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }
    for (const policy of ["clinic_subscriptions_select_owner", "subscription_payments_select_owner"]) {
      expect(sql).toMatch(
        new RegExp(`create policy ${policy}[\\s\\S]*?\\(select public\\.is_clinic_owner\\(\\)\\)\\);`),
      );
    }
    expect(sql).toContain(
      "revoke all on public.receipt_counters, public.trial_claims from public, anon, authenticated;",
    );
    expect(sql).not.toMatch(/grant (insert|update|delete)/);
  });
});

describe("0005 extend_clinic_subscription (plan §7.4)", () => {
  const extend = functionBody(sql, "extend_clinic_subscription");

  it("is the DEV's alone, checked by the database itself", () => {
    expect(extend).toContain("security definer");
    expect(extend).toMatch(/if not public\.is_platform_dev\(\) then\s+raise exception [^;]*errcode = '42501'/);
  });

  it("adds a month or a year from the later of the last day and yesterday, or sets the date given", () => {
    expect(extend).toContain(
      "when 'MONTHLY' then (greatest(today - 1, subscription.valid_until) + interval '1 month')::date",
    );
    expect(extend).toContain(
      "when 'YEARLY' then (greatest(today - 1, subscription.valid_until) + interval '12 months')::date",
    );
    expect(extend).toContain("when 'CUSTOM' then p_valid_until");
    expect(extend).toContain("set plan = case when p_kind = 'CUSTOM' then plan else p_kind end");
  });

  it("numbers a receipt from the counter, by the financial year in the clinic timezone, only for money received", () => {
    expect(extend).toContain("if p_amount_paise > 0 then");
    expect(extend).toContain(`public.financial_year((now() at time zone '${CLINIC_TIME_ZONE}')::date)`);
    expect(extend).toContain("on conflict (financial_year) do update set last_number = counter.last_number + 1");
  });

  it("writes a platform audit row", () => {
    expect(extend).toMatch(/null, \(select auth\.uid\(\)\), 'CREATE', 'subscription_payments', payment\.id/);
  });
});
