import { describe, expect, it } from "vitest";

import { PLATFORM_SETTING_BOUNDS, PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0016_patient_import.sql");
const imported = functionBody(sql, "import_patients");

describe("0016 the import's row cap (D128)", () => {
  it("is a platform setting, starting and bounded as platform.ts says", () => {
    const { min, max } = PLATFORM_SETTING_BOUNDS.maxImportRows;
    expect(sql).toContain(
      `add column max_import_rows integer not null default ${PLATFORM_SETTING_DEFAULTS.maxImportRows} check (max_import_rows between ${min} and ${max});`,
    );
  });

  it("is changed by the DEV through update_platform_settings, like every other", () => {
    const update = functionBody(sql, "update_platform_settings");
    expect(update).toContain("'max_import_rows'");
    expect(update).toContain("max_import_rows = case when p_changes ? 'max_import_rows'");
    expect(sql).toContain("grant execute on function public.update_platform_settings(jsonb, text) to authenticated;");
  });
});

describe("0016 import_patients, safe to send again", () => {
  it("replaces the old one, whose answer had another shape", () => {
    expect(sql).toContain("drop function public.import_patients(jsonb);");
    expect(sql).toContain("returns table (patient_id uuid, patient_number integer, created boolean)");
  });

  it("is the owner's alone, while the clinic can write", () => {
    expect(imported).toContain("security definer");
    expect(imported).toContain("if clinic is null or not public.is_clinic_owner() then");
    expect(imported).toContain("perform public.require_clinic_write(clinic);");
    expect(sql).toContain("revoke all on function public.import_patients(jsonb) from public, anon;");
    expect(sql).toContain("grant execute on function public.import_patients(jsonb) to authenticated;");
  });

  it("refuses a row without its key, and takes one batch of a clinic at a time", () => {
    expect(imported).toMatch(
      /where given\.idempotency_key is null\s+\) then\s+raise exception [^;]*'IDEMPOTENCY_KEY_REQUIRED'/,
    );
    expect(imported).toContain("perform pg_advisory_xact_lock(hashtextextended(clinic::text || ':import', 0));");
  });

  it("adds only the rows whose keys are new, numbered in the order given, and finds the rest", () => {
    expect(imported).toContain("where given.idempotency_key not in (select found.idempotency_key from found)");
    expect(imported).toMatch(/from given\s+where given\.idempotency_key not in [^;]*order by given\.ordinality/);
    expect(imported).toContain("patient.clinic_id = clinic\n       and patient.idempotency_key in");
    expect(imported).toContain("added.id is not null");
  });

  it("takes only a patient's own fields from a row: never a number, a clinic, a doctor or who did it", () => {
    expect(imported).not.toMatch(
      /given\.(patient_number|clinic_id|archived_at|archived_by|created_by|assigned_doctor_id)/,
    );
  });
});
