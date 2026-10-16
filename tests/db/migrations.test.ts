import { describe, expect, it } from "vitest";

import { isErrorMessageCode } from "@/constants/messages";
import { isPermission } from "@/constants/permissions";
import { CLINIC_ROLES, PLATFORM_ROLES } from "@/constants/roles";
import { allMigrations, migrationNames, quoted } from "@tests/support/sql";

/**
 * What every migration keeps to (AGENTS.md §7, §25, plan §27): numbered in
 * order, RLS on every table, nothing granted to `anon`, every function with an
 * empty search path, every refusal a catalogue code, every permission one the
 * app knows.
 */
const sql = allMigrations();
const statements = sql.split(/;\s*\n/);
const tables = [...sql.matchAll(/create table public\.(\w+) \(/g)].map((match) => match[1]);

describe("the migrations", () => {
  it("are numbered in order from 0001, with snake-case names", () => {
    migrationNames().forEach((name, index) => {
      expect(name).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
      expect(name.slice(0, 4)).toBe(String(index + 1).padStart(4, "0"));
    });
  });

  it("turn RLS on for every table they create", () => {
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(sql, table).toContain(`alter table public.${table} enable row level security;`);
    }
  });

  it("grant nothing to anon", () => {
    const grants = statements.filter((statement) => /^\s*grant\b/m.test(statement));
    expect(grants.length).toBeGreaterThan(0);
    for (const grant of grants) expect(grant).not.toMatch(/\banon\b/);
  });

  it("give every function an empty search path", () => {
    const functions = sql.split("create or replace function ").slice(1);
    expect(functions.length).toBeGreaterThan(0);
    for (const definition of functions) {
      const header = definition.slice(0, definition.indexOf("$$"));
      expect(header, definition.slice(0, 60)).toContain("set search_path = ''");
    }
  });

  it("refuse only with catalogue codes", () => {
    const hints = [...sql.matchAll(/hint = '(\w+)'/g)].map((match) => match[1]);
    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) expect(isErrorMessageCode(hint), hint).toBe(true);
  });

  it("ask only for permissions in the catalogue", () => {
    const asked = [...sql.matchAll(/has_permission\('([^']+)'\)/g)].map((match) => match[1]);
    expect(asked.length).toBeGreaterThan(0);
    for (const permission of asked) expect(isPermission(permission), permission).toBe(true);
  });

  it("call the RLS helpers once per statement in every policy, as (select fn())", () => {
    const policies = statements.filter((statement) => /create policy/.test(statement));
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      const calls = [...policy.matchAll(/(\(select )?(public\.\w+|auth\.uid)\(/g)];
      for (const [, select, helper] of calls) expect(select, `${helper} in ${policy.slice(0, 60)}`).toBeDefined();
    }
  });

  it("hang every clinic-owned table from its clinic, deleted with it and indexed by it", () => {
    const owned = statements.filter((statement) =>
      /clinic_id uuid (not null|primary key) references public\.clinics/.test(statement),
    );
    expect(owned.length).toBeGreaterThan(0);
    for (const statement of owned) {
      const table = /create table public\.(\w+)/.exec(statement)![1];
      expect(statement, table).toMatch(/clinic_id uuid [^\n]*references public\.clinics \(id\) on delete cascade/);
      const leadsAnIndex =
        /clinic_id uuid primary key|primary key \(clinic_id\b/.test(statement) ||
        new RegExp(`on public\\.${table} \\(clinic_id\\b`).test(sql);
      expect(leadsAnIndex, table).toBe(true);
    }
  });

  it("name only the roles the app knows", () => {
    const named = [...sql.matchAll(/role (?:=|<>) ('\w+')/g)].flatMap((match) => quoted(match[1]));
    expect(named.length).toBeGreaterThan(0);
    for (const role of named) expect([...CLINIC_ROLES, ...PLATFORM_ROLES]).toContain(role);
  });
});
