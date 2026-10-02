import { describe, expect, it } from "vitest";

import { TEXT_LIMITS } from "@/constants/limits";
import { PLATFORM_ROLES } from "@/constants/roles";
import { checkedValues, cleanTextLimit, columnLine, functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0002_identity.sql");

describe("0002 identity", () => {
  it("keeps one profile per auth user, gone with it", () => {
    expect(columnLine(sql, "profiles", "id")).toContain("references auth.users (id) on delete cascade");
  });

  it("makes the email and the mobile each unique, so either signs in (D39)", () => {
    expect(columnLine(sql, "profiles", "email")).toMatch(/extensions\.citext not null unique/);
    expect(columnLine(sql, "profiles", "phone")).toMatch(/text unique check \(public\.is_indian_mobile\(phone\)\)/);
  });

  it("bounds the name as the forms do", () => {
    expect(cleanTextLimit(sql, "profiles", "full_name")).toBe(TEXT_LIMITS.personName);
  });

  it("knows the platform roles the app knows", () => {
    expect(checkedValues(sql, "platform_role")).toEqual([...PLATFORM_ROLES]);
  });

  it("lets a signed-in user read only their own profile, and write none", () => {
    expect(sql).toContain("alter table public.profiles enable row level security;");
    expect(sql).toMatch(/create policy profiles_select_own[\s\S]*using \(id = \(select auth\.uid\(\)\)\);/);
    expect(sql).toContain("grant select on public.profiles to authenticated;");
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*public\.profiles/);
  });

  it("asks whether the caller is the DEV from the profile, never from user metadata", () => {
    const isDev = functionBody(sql, "is_platform_dev");
    expect(isDev).toContain("security definer");
    expect(isDev).toContain("platform_role = 'DEV'");
    expect(sql).not.toMatch(/user_metadata|raw_user_meta_data/);
  });
});
