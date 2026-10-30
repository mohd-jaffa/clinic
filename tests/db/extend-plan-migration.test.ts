import { describe, expect, it } from "vitest";

import { CLINIC_TIME_ZONE } from "@/lib/dates/calendar";
import { functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0036_extend_plan.sql");
const extend = functionBody(sql, "extend_clinic_subscription");
const clinic = functionBody(sql, "console_clinic");
const SIGNATURE = "extend_clinic_subscription(uuid, text, integer, text, text, date, date, text, uuid, text)";

describe("0036 extending a plan (plan §7.4; D373 – D376)", () => {
  it("holds Monthly and Yearly to money received; a date set by hand may be free (D374)", () => {
    expect(sql).toContain(
      "add constraint subscription_payments_period_paid check (plan = 'CUSTOM' or amount_paise > 0);",
    );
  });

  it("records an extension once per key, the clinic leading the key's index (AGENTS.md §26)", () => {
    expect(sql).toContain("add column idempotency_key uuid not null,");
    expect(sql).toContain(
      "add constraint subscription_payments_idempotency_key_key unique (clinic_id, idempotency_key),",
    );
    expect(extend).toMatch(
      /if p_idempotency_key is null then\s+raise exception [^;]*hint = 'IDEMPOTENCY_KEY_REQUIRED'/,
    );
    // The plan's row is held first, so the same key sent twice at once finds the first one's payment.
    expect(extend.indexOf("for update")).toBeLessThan(extend.indexOf("recorded.idempotency_key = p_idempotency_key"));
    expect(extend).toContain("'created', false");
    expect(extend).toContain("'created', true");
  });

  it("replaces 0005's function, the DEV's alone, checked by the database itself", () => {
    expect(sql).toContain(
      "drop function public.extend_clinic_subscription(uuid, text, integer, text, text, date, date, text, text);",
    );
    expect(extend).toContain("security definer");
    expect(extend).toMatch(/if not public\.is_platform_dev\(\) then\s+raise exception [^;]*errcode = '42501'/);
    expect(sql).toContain(`revoke all on function public.${SIGNATURE}\n  from public, anon;`);
    expect(sql).toContain(`grant execute on function public.${SIGNATURE}\n  to authenticated;`);
  });

  it("keeps 0005's rule: a month or a year on from the later of the last day and yesterday, or the date given", () => {
    expect(extend).toContain(
      "when 'MONTHLY' then (greatest(today - 1, subscription.valid_until) + interval '1 month')::date",
    );
    expect(extend).toContain(
      "when 'YEARLY' then (greatest(today - 1, subscription.valid_until) + interval '12 months')::date",
    );
    expect(extend).toContain("when 'CUSTOM' then p_valid_until");
    expect(extend).toContain("set plan = case when p_kind = 'CUSTOM' then plan else p_kind end");
    expect(extend).toContain(`public.financial_year((now() at time zone '${CLINIC_TIME_ZONE}')::date)`);
    expect(extend).toMatch(/null, \(select auth\.uid\(\)\), 'CREATE', 'subscription_payments', payment\.id/);
  });

  it("answers with the clinic as the console now sees it, and never the key", () => {
    expect(extend).toContain("'clinic', public.console_clinic(p_clinic_id)");
    expect(extend).toContain("'payment', to_jsonb(payment) - 'idempotency_key'");
  });

  it("gives a clinic's page the live prices, which fill in Monthly and Yearly", () => {
    expect(clinic).toContain(
      "jsonb_build_object('monthly_paise', settings.monthly_price_paise, 'yearly_paise', settings.yearly_price_paise)",
    );
    expect(clinic).toContain("cross join public.platform_settings as settings");
    expect(clinic).not.toContain("security definer");
  });
});
