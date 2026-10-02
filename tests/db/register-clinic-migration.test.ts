import { describe, expect, it } from "vitest";

import { PLATFORM_SETTING_BOUNDS } from "@/constants/platform";
import { DEFAULT_APPOINTMENT_TYPES, DEFAULT_CONSULTATION_SERVICE, DEFAULT_EXPENSE_CATEGORIES } from "@/constants/seeds";
import { functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0008_register_clinic.sql");
const register = functionBody(sql, "register_clinic");

/** The rows of one `insert into public.<table> (...) values ...;` in register_clinic. */
function seeded(table: string): string[][] {
  const values = new RegExp(`insert into public\\.${table} \\([^)]*\\)\\s+values([\\s\\S]*?);`).exec(register)![1];
  return [...values.matchAll(/\(new_clinic_id, ([^)]*)\)/g)].map(([, row]) =>
    row.split(", ").map((value) => value.replace(/^'|'$/g, "")),
  );
}

describe("0008 register_clinic", () => {
  it("is the server's alone", () => {
    expect(register).toContain("security definer");
    expect(sql).toMatch(/revoke all on function public\.register_clinic\([^)]*\)\s+from public, anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.register_clinic\([^)]*\)\s+to service_role;/);
  });

  it("makes the owner whole and active, and a doctor profile when they see patients", () => {
    expect(register).toContain("values (new_clinic_id, p_user_id, 'OWNER', 'ACTIVE', now())");
    expect(register).toMatch(/if p_sees_patients then\s+insert into public\.doctors/);
  });

  it("starts a trial of trial_days once per mobile, and none after — read-only at once, whatever the grace", () => {
    expect(register).toContain(
      "trial := not exists (select 1 from public.trial_claims where mobile_hmac = p_mobile_hmac);",
    );
    expect(register).toContain(
      `last_day := case when trial then today + settings.trial_days else today - ${PLATFORM_SETTING_BOUNDS.graceDays.max + 1} end;`,
    );
    expect(register).toContain("values (new_clinic_id, 'TRIAL', last_day);");
  });

  it("seeds exactly the appointment types in seeds.ts, in order", () => {
    expect(seeded("appointment_types")).toEqual(
      DEFAULT_APPOINTMENT_TYPES.map(({ name, minutes }, index) => [name, String(minutes), String(index + 1)]),
    );
  });

  it("seeds exactly the expense categories in seeds.ts, in order", () => {
    expect(seeded("expense_categories")).toEqual(
      DEFAULT_EXPENSE_CATEGORIES.map((name, index) => [name, String(index + 1)]),
    );
  });

  it("seeds the Consultation entry in seeds.ts, written by the owner", () => {
    const { name, category, pricePaise } = DEFAULT_CONSULTATION_SERVICE;
    expect(seeded("services")).toEqual([[name, category, String(pricePaise), "p_user_id", "p_user_id"]]);
  });

  it("writes an audit row of the clinic made, and whether it had a trial", () => {
    expect(register).toContain(
      "values (new_clinic_id, p_user_id, 'CREATE', 'clinics', new_clinic_id, jsonb_build_object('trial', trial));",
    );
  });
});
