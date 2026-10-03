import { describe, expect, it } from "vitest";

import { isErrorMessageCode } from "@/constants/messages";
import { functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0010_catalogue_rules.sql");

describe("0010 the rules of the clinic's catalogues (plan §9; D81, D83)", () => {
  it("puts a new appointment type or expense category last, unless it is given a place", () => {
    for (const table of ["appointment_types", "expense_categories"]) {
      expect(sql).toContain(`alter table public.${table} alter column position drop default;`);
      expect(sql).toContain(
        `create trigger set_${table}_position before insert on public.${table}\nfor each row when (new.position is null) execute function public.set_catalogue_position();`,
      );
    }
    const place = functionBody(sql, "set_catalogue_position");
    expect(place).toContain("coalesce(max(t.position), 0) + 1");
    expect(place).toContain("where t.clinic_id = $1");
  });

  it("keeps one active appointment type, one expense category and one Consultation", () => {
    expect(sql).toContain(
      "create trigger keep_one_appointment_type before update of active on public.appointment_types\nfor each row when (old.active and not new.active)",
    );
    expect(sql).toContain(
      "create trigger keep_one_expense_category before update of active on public.expense_categories\nfor each row when (old.active and not new.active)",
    );
    // Archiving the last Consultation, or moving it to another category, alike.
    expect(sql).toContain(
      "create trigger keep_one_consultation_service before update of active, category on public.services\nfor each row when (old.active and old.category = 'CONSULTATION' and not (new.active and new.category = 'CONSULTATION'))",
    );
  });

  it("refuses with the app's own codes, looking at the clinic's other active entries under a lock", () => {
    const codes = [...sql.matchAll(/keep_one_catalogue_entry\('(\w+)'/g)].map((match) => match[1]);
    expect(codes).toEqual(["APPOINTMENT_TYPE_REQUIRED", "EXPENSE_CATEGORY_REQUIRED", "CONSULTATION_SERVICE_REQUIRED"]);
    for (const code of codes) expect(isErrorMessageCode(code), code).toBe(true);

    const keep = functionBody(sql, "keep_one_catalogue_entry");
    expect(keep).toContain("perform 1 from public.clinics as c where c.id = old.clinic_id for no key update;");
    expect(keep).toContain("t.clinic_id = $1 and t.id <> $2 and t.active");
    expect(keep).toContain("using hint = tg_argv[0]");
  });

  it("lets no one call its functions directly", () => {
    expect(sql).toContain("revoke all on function public.set_catalogue_position() from public, anon, authenticated;");
    expect(sql).toContain("revoke all on function public.keep_one_catalogue_entry() from public, anon, authenticated;");
  });
});
