import { describe, expect, it } from "vitest";

import { PLAN_NOTICES } from "@/constants/statuses";
import { checkedValues, functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0037_subscription_notices.sql");
const claim = functionBody(sql, "claim_subscription_notices");
const release = functionBody(sql, "release_subscription_notices");
const call = functionBody(sql, "call_subscription_notices");

describe("0037 the plan emails (plan §22; D382 – D386)", () => {
  it("keeps on the subscription what each plan was last told, all or none, in the app's own notices", () => {
    expect(checkedValues(sql, "last_notice")).toEqual([...PLAN_NOTICES]);
    expect(sql).toContain("add column last_notice_due date,");
    expect(sql).toContain("add column last_notice_for date,");
    expect(sql).toContain(
      "(last_notice is null) = (last_notice_due is null) and (last_notice is null) = (last_notice_for is null)",
    );
    expect(sql).toContain(
      "create index clinic_subscriptions_valid_until_idx on public.clinic_subscriptions (valid_until);",
    );
  });

  it("finds the latest notice due by the clinic's own today: each expiry email day, the day after, the day the grace ends", () => {
    expect(claim).toContain("select 'ENDS_SOON' as notice, subscription.valid_until - ahead_by as day");
    expect(claim).toContain("select 'ENDED', subscription.valid_until + 1 where settings.grace_days > 0");
    expect(claim).toContain("select 'READ_ONLY', subscription.valid_until + settings.grace_days + 1");
    expect(claim).toContain("cross join lateral (select (now() at time zone clinic.timezone)::date as today) as local");
    expect(claim).toContain("where candidate.day <= local.today");
    expect(claim).toContain("order by candidate.day desc, (candidate.notice = 'READ_ONLY') desc");
  });

  it("sends each once for a last day — a new last day starts again — and a missed day's alone (D383)", () => {
    expect(claim).toContain("subscription.last_notice_for is distinct from subscription.valid_until");
    expect(claim).toContain("or subscription.last_notice_due < stage.day");
  });

  it("tells a clinic waiting for activation nothing until it is extended (D385)", () => {
    expect(claim).toMatch(
      /and not \(\s+subscription\.plan = 'TRIAL'\s+and subscription\.valid_until < \(clinic\.created_at at time zone clinic\.timezone\)::date\s+\)/,
    );
  });

  it("marks as it claims, skipping what another run holds and what it has told since, so no one is told twice", () => {
    expect(claim).toContain("for update skip locked");
    expect(claim).toContain("subscription.last_notice_due is not distinct from due.previous_due");
    // Released only while it still holds this run's claim.
    expect(release).toContain("and subscription.last_notice_due = claim.due");
    expect(release).toContain("and subscription.last_notice_for = claim.valid_until");
  });

  it("is the server's alone to claim and release", () => {
    for (const name of ["claim_subscription_notices(integer)", "release_subscription_notices(jsonb)"]) {
      expect(sql).toContain(`revoke all on function public.${name} from public, anon, authenticated;`);
      expect(sql).toContain(`grant execute on function public.${name} to service_role;`);
    }
    expect(sql).toContain(
      "revoke all on function public.call_subscription_notices() from public, anon, authenticated;",
    );
  });

  it("calls the app every day at 9:00 in India, with its address and secret from Vault, never written here (D382)", () => {
    expect(sql).toContain(
      "select cron.schedule('subscription-notices', '30 3 * * *', $$select public.call_subscription_notices()$$);",
    );
    expect(call).toContain("from vault.decrypted_secrets where name = 'subscription_notices_url'");
    expect(call).toContain("from vault.decrypted_secrets where name = 'cron_secret'");
    expect(call).toContain("'Authorization', 'Bearer ' || secret");
    expect(call).toMatch(/if address is null or secret is null then\s+raise notice[^;]*;\s+return;/);
    expect(sql).not.toMatch(/https?:\/\/(?!<app>)/);
  });
});
