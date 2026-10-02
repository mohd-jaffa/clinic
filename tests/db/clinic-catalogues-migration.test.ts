import { describe, expect, it } from "vitest";

import { APPOINTMENT_MINUTES, MAX_AMOUNT_PAISE, TEXT_LIMITS } from "@/constants/limits";
import { SERVICE_CATEGORIES } from "@/constants/statuses";
import { betweenBounds, checkedValues, cleanTextLimit, readMigration } from "@tests/support/sql";

const sql = readMigration("0007_clinic_catalogues.sql");
const tables = ["services", "appointment_types", "expense_categories"];

describe("0007 the clinic's catalogues", () => {
  it("know the price-list categories the app knows", () => {
    expect(checkedValues(sql, "category")).toEqual([...SERVICE_CATEGORIES]);
  });

  it("bound names, prices and lengths as the forms do", () => {
    expect(cleanTextLimit(sql, "services", "name")).toBe(TEXT_LIMITS.serviceName);
    expect(cleanTextLimit(sql, "appointment_types", "name")).toBe(TEXT_LIMITS.catalogueName);
    expect(cleanTextLimit(sql, "expense_categories", "name")).toBe(TEXT_LIMITS.catalogueName);
    expect(betweenBounds(sql, "services", "price_paise")).toEqual({ min: 0, max: MAX_AMOUNT_PAISE });
    expect(betweenBounds(sql, "appointment_types", "default_minutes")).toEqual(APPOINTMENT_MINUTES);
  });

  it("keep a name unique among the active entries, whatever its case", () => {
    for (const table of tables) {
      expect(sql).toContain(
        `create unique index ${table}_clinic_name_unique on public.${table} (clinic_id, lower(name)) where active;`,
      );
    }
  });

  it("record who changed a price", () => {
    expect(sql).toContain("create trigger set_services_actor before insert or update on public.services");
  });

  it("are read by every member, and written only with settings.manage while the clinic can write", () => {
    for (const table of tables) {
      expect(sql).toMatch(
        new RegExp(
          `create policy ${table}_select on public\\.${table}\\nfor select to authenticated\\nusing \\(clinic_id = \\(select public\\.current_clinic_id\\(\\)\\)\\);`,
        ),
      );
      for (const action of ["insert", "update"]) {
        const policy = new RegExp(`create policy ${table}_${action}[\\s\\S]*?;`).exec(sql)![0];
        expect(policy, `${table} ${action}`).toContain("(select public.has_permission('settings.manage'))");
        expect(policy, `${table} ${action}`).toContain("(select public.clinic_can_write())");
      }
    }
  });

  it("are archived, never deleted", () => {
    expect(sql).toContain(
      "grant select, insert, update on public.services, public.appointment_types, public.expense_categories to authenticated;",
    );
    expect(sql).not.toMatch(/for delete|grant [^;]*delete/);
  });
});
