import { describe, expect, it } from "vitest";

import { ERROR_LOG_LIMITS } from "@/constants/limits";
import { AUDIT_ACTIONS, ERROR_SOURCES } from "@/constants/statuses";
import { checkedValues, cleanTextLimit, columnLine, functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0006_logs.sql");

describe("0006 the audit trail", () => {
  it("knows the actions the app knows", () => {
    expect(checkedValues(sql, "action")).toEqual([...AUDIT_ACTIONS]);
  });

  it("belongs to a clinic, or to the platform, and outlives the person who acted", () => {
    expect(columnLine(sql, "audit_logs", "clinic_id")).toContain(
      "uuid references public.clinics (id) on delete cascade",
    );
    expect(columnLine(sql, "audit_logs", "actor_id")).toContain("references public.profiles (id) on delete set null");
    expect(cleanTextLimit(sql, "audit_logs", "summary")).toBe(300);
  });

  it("is read by the clinic's owner, written by the server only, and never changed", () => {
    expect(sql).toMatch(/create policy audit_logs_select_owner[\s\S]*?\(select public\.is_clinic_owner\(\)\)\);/);
    expect(sql).toContain("grant select on public.audit_logs to authenticated;");
    expect(sql).toContain("revoke update, truncate on public.audit_logs from service_role;");
    expect(sql).not.toMatch(/for (insert|update|delete|all)/);
  });
});

describe("0006 the error log", () => {
  it("knows the sources the app knows", () => {
    expect(checkedValues(sql, "source")).toEqual([...ERROR_SOURCES]);
  });

  it("keeps as much of a failure as captureError clips it to", () => {
    for (const [field, max] of Object.entries(ERROR_LOG_LIMITS)) {
      expect(columnLine(sql, "error_logs", field), field).toContain(`check (char_length(${field}) <= ${max})`);
    }
  });

  it("is reached by no one signed in, and never changed", () => {
    expect(sql).toContain("revoke all on public.error_logs from public, anon, authenticated;");
    expect(sql).toContain("revoke update, truncate on public.error_logs from service_role;");
    expect(sql).not.toMatch(/create policy error_logs/);
  });
});

describe("0006 the purge", () => {
  it("drops what is older than the retention the DEV set, read each time", () => {
    const purge = functionBody(sql, "clean_up_logs");
    expect(purge).toContain("select audit_keep_days, error_log_keep_days from public.platform_settings where id");
    expect(purge).toContain("make_interval(days => (select audit_keep_days from settings))");
    expect(purge).toContain("make_interval(days => (select error_log_keep_days from settings))");
  });

  it("runs every hour, by the database's own scheduler", () => {
    expect(sql).toContain("select cron.schedule('clean-up-logs', '17 * * * *', $$select public.clean_up_logs()$$);");
    expect(sql).toContain("revoke all on function public.clean_up_logs() from public, anon, authenticated;");
  });
});
