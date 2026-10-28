import { describe, expect, it } from "vitest";

import { CLINIC_STANDINGS, CONSOLE_CLINIC_FILTERS } from "@/constants/statuses";
import { functionBody, quoted, readMigration } from "@tests/support/sql";

const sql = readMigration("0035_console.sql");
const rows = functionBody(sql, "console_clinic_rows");
const overview = functionBody(sql, "console_overview");
const clinics = functionBody(sql, "console_clinics");
const clinic = functionBody(sql, "console_clinic");
const accounts = functionBody(sql, "console_accounts");
const audit = functionBody(sql, "console_audit");

const READS = [
  "console_clinic_rows()",
  "console_overview()",
  "console_clinics(text, text, text, integer, integer)",
  "console_clinic(uuid)",
  "console_accounts(text, text, integer, integer)",
  "console_audit(integer, integer)",
];

describe("0035 the developer console's reads (plan §20; D367 – D372)", () => {
  it("indexes the newest sign-ups and accounts first, and the month's extensions", () => {
    expect(sql).toContain("create index clinics_created_at_idx on public.clinics (created_at desc, id desc);");
    expect(sql).toContain("create index profiles_created_at_idx on public.profiles (created_at desc, id desc);");
    expect(sql).toContain(
      "create index subscription_payments_created_at_idx on public.subscription_payments (created_at);",
    );
  });

  it("is read by the server as itself alone, never by a signed-in user", () => {
    for (const read of READS) {
      expect(sql).toContain(`revoke all on function public.${read} from public, anon, authenticated;`);
      expect(sql).toContain(`grant execute on function public.${read} to service_role;`);
    }
    // Only Accounts reads auth.users, for the last sign-in.
    expect(accounts).toContain("security definer");
    expect(accounts).toContain("join auth.users as account on account.id = profile.id");
    for (const body of [rows, overview, clinics, clinic, audit]) expect(body).not.toContain("security definer");
  });

  it("counts a clinic once: a trial still running as Trial, any other by its state, with the app's standings (D368)", () => {
    expect(rows).toContain(
      "case when subscription.plan = 'TRIAL' and standing.state in ('ACTIVE', 'EXPIRING') then 'TRIAL' else standing.state end",
    );
    expect(quoted(/unnest\(array\[([^\]]*)\]\)/.exec(overview)![1])).toEqual([...CLINIC_STANDINGS]);
  });

  it("knows No trial as a trial whose last day is before its sign-up, which only a claimed mobile is given (plan §7.6)", () => {
    expect(rows).toContain(
      "subscription.plan = 'TRIAL' and subscription.valid_until < (clinic.created_at at time zone clinic.timezone)::date",
    );
  });

  it("filters the Clinics list as the app does, and refuses any other filter", () => {
    expect(quoted(/p_filter not in \(([^)]*)\)/.exec(clinics)![1])).toEqual([...CONSOLE_CLINIC_FILTERS]);
    expect(clinics).toContain("using errcode = '22023'");
    expect(clinics).toContain("order by clinic.signed_up_at desc, clinic.id desc");
  });

  it("hands back nothing of a clinic's own records: no patient, visit, bill or payment of theirs", () => {
    for (const body of [rows, overview, clinics, clinic, accounts, audit]) {
      for (const table of ["patients", "visits", "bills", "payments", "expenses", "appointments", "prescriptions"]) {
        expect(body).not.toContain(`public.${table} `);
      }
    }
    // The platform's audit only: never a clinic's activity.
    expect(audit).toContain("where entry.clinic_id is null");
  });
});
