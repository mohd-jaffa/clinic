import { describe, expect, it } from "vitest";

import { TEXT_LIMITS } from "@/constants/limits";
import {
  PLATFORM_SETTING_BOUNDS,
  PLATFORM_SETTING_COLUMNS,
  PLATFORM_SETTING_DEFAULTS,
  type PlatformSettingKey,
} from "@/constants/platform";
import { cleanTextLimit, columnLine, latestFunctionBody, quoted, readMigration, tableBody } from "@tests/support/sql";

const sql = readMigration("0004_platform_settings.sql");
// Its latest version: a migration that adds a setting replaces it (0016).
const update = latestFunctionBody("update_platform_settings");
/** The settings a later migration added, each with its own contract test. */
const ADDED_LATER: readonly PlatformSettingKey[] = ["maxImportRows"];
const keys = (Object.keys(PLATFORM_SETTING_COLUMNS) as PlatformSettingKey[]).filter(
  (key) => !ADDED_LATER.includes(key),
);

describe("0004 platform settings", () => {
  it("has a column for every setting the app knows, and no other", () => {
    const columns = tableBody(sql, "platform_settings")
      .split("\n")
      .map((line) => /^ {2}([a-z_]+) /.exec(line)?.[1])
      .filter((column): column is string => !!column && column !== "constraint");
    expect(columns).toEqual(["id", ...keys.map((key) => PLATFORM_SETTING_COLUMNS[key]), "updated_by", "updated_at"]);
  });

  it("starts every setting at the default in platform.ts", () => {
    for (const key of keys) {
      const line = columnLine(sql, "platform_settings", PLATFORM_SETTING_COLUMNS[key]);
      const value = PLATFORM_SETTING_DEFAULTS[key];
      if (value === null) expect(line, key).not.toMatch(/ default /);
      else if (Array.isArray(value)) expect(line, key).toContain(`default '{${value.join(",")}}'`);
      else expect(line, key).toContain(`default ${value} `);
    }
    expect(sql).toContain("insert into public.platform_settings (id) values (true);");
  });

  it("bounds every number as platform.ts does", () => {
    for (const [key, bound] of Object.entries(PLATFORM_SETTING_BOUNDS)) {
      const column = PLATFORM_SETTING_COLUMNS[key as PlatformSettingKey];
      if ("maxCount" in bound || ADDED_LATER.includes(key as PlatformSettingKey)) continue;
      expect(columnLine(sql, "platform_settings", column), key).toContain(
        `check (${column} between ${bound.min} and ${bound.max})`,
      );
    }
    const { min, max, maxCount } = PLATFORM_SETTING_BOUNDS.expiryNoticeDays;
    expect(sql).toContain(`cardinality(expiry_notice_days) <= ${maxCount}`);
    expect(sql).toContain(`${min} <= all (expiry_notice_days)`);
    expect(sql).toContain(`${max} >= all (expiry_notice_days)`);
  });

  it("bounds the renewal contact and the business details as the forms do", () => {
    expect(cleanTextLimit(sql, "platform_settings", "renewal_contact_name")).toBe(TEXT_LIMITS.personName);
    expect(columnLine(sql, "platform_settings", "renewal_contact_phone")).toContain("public.is_indian_mobile(");
    expect(columnLine(sql, "platform_settings", "renewal_contact_email")).toContain("public.is_email(");
    expect(sql).toContain(`char_length(renewal_upi_id) <= ${TEXT_LIMITS.upiId}`);
    expect(cleanTextLimit(sql, "platform_settings", "business_name")).toBe(TEXT_LIMITS.clinicName);
    expect(cleanTextLimit(sql, "platform_settings", "business_address")).toBe(TEXT_LIMITS.address);
  });

  it("is one row, read by no signed-in user, never added to or deleted", () => {
    expect(columnLine(sql, "platform_settings", "id")).toContain("boolean primary key default true check (id)");
    expect(sql).toContain("alter table public.platform_settings enable row level security;");
    expect(sql).toContain("revoke all on public.platform_settings from public, anon, authenticated;");
    expect(sql).toContain("revoke insert, delete, truncate on public.platform_settings from service_role;");
    expect(sql).not.toContain("create policy");
  });
});

describe("update_platform_settings, as last replaced", () => {
  it("is the DEV's alone, checked by the database itself", () => {
    expect(update).toContain("security definer");
    expect(update).toMatch(/if not public\.is_platform_dev\(\) then\s+raise exception [^;]*errcode = '42501'/);
    expect(sql).toContain("grant execute on function public.update_platform_settings(jsonb, text) to authenticated;");
  });

  it("changes exactly the settings the app knows, each by name, and refuses any other name", () => {
    const named = /settings constant text\[\] := array\[([\s\S]*?)\];/.exec(update)![1];
    expect(quoted(named)).toEqual(Object.values(PLATFORM_SETTING_COLUMNS));
    for (const column of Object.values(PLATFORM_SETTING_COLUMNS)) {
      expect(update, column).toContain(`${column} = case when p_changes ? '${column}'`);
    }
    expect(update).toMatch(/where name <> all \(settings\)\) then\s+raise exception [^;]*errcode = '22023'/);
  });

  it("records who changed it, and a platform audit row of each value from and to", () => {
    expect(update).toContain("updated_by = (select auth.uid())");
    expect(update).toContain("jsonb_build_object('from', to_jsonb(was) -> name, 'to', to_jsonb(now_is) -> name)");
    expect(update).toContain(
      "values (null, (select auth.uid()), 'UPDATE', 'platform_settings', null, changed, p_request_id);",
    );
  });
});
