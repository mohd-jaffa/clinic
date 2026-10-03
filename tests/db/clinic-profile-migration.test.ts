import { describe, expect, it } from "vitest";

import { LOGO_BUCKET, LOGO_MIME_TYPES, MAX_LOGO_BYTES } from "@/constants/uploads";
import { GSTIN } from "@/lib/validation/primitives";
import { functionBody, quoted, readMigration } from "@tests/support/sql";

const sql = readMigration("0009_clinic_profile.sql");

describe("0009 the clinic's profile and its logo (plan §9, §28.8; D77 – D79)", () => {
  it("keeps one logo reference, only inside the clinic's own folder", () => {
    expect(sql).toContain("alter table public.clinics add column logo_path text;");
    expect(sql).toContain("logo_path ~ ('^clinics/' || id::text || '/logo/");
  });

  it("checks the GSTIN as the form does", () => {
    // The column's CHECK (0003) and the schema's GSTIN are one shape.
    expect(readMigration("0003_clinics_and_members.sql")).toContain(`gstin ~ '${GSTIN.source}'`);
  });

  it("changes the clinic only with settings.manage, while it can write", () => {
    const guard = functionBody(sql, "require_clinic_settings");
    expect(guard).toContain("public.has_permission('settings.manage')");
    expect(guard).toContain("hint = 'AUTH_PERMISSION_DENIED'");
    expect(guard).toContain("perform public.require_clinic_write(clinic);");
    for (const name of ["update_clinic_profile", "set_clinic_logo", "clear_clinic_logo"]) {
      expect(functionBody(sql, name), name).toContain("public.require_clinic_settings()");
    }
  });

  it("changes only the profile's own columns — never a counter, the deletion, the logo or the timezone", () => {
    const update = functionBody(sql, "update_clinic_profile");
    const columns = [...update.matchAll(/(\w+) = case when p_changes \? '(\w+)'/g)].map(([, column, key]) => {
      expect(key).toBe(column);
      return column;
    });
    expect(columns).toEqual([
      "name",
      "clinic_type",
      "phone",
      "email",
      "address",
      "city",
      "gstin",
      "paper_size",
      "fee_timing",
    ]);
  });

  it("points the clinic only at a file already stored, handing back the one it let go", () => {
    const set = functionBody(sql, "set_clinic_logo");
    expect(set).toContain(`o.bucket_id = '${LOGO_BUCKET}' and o.name = p_path`);
    expect(set).toContain("hint = 'LOGO_UPLOAD_FAILED'");
    expect(set).toContain("return previous;");
    expect(functionBody(sql, "clear_clinic_logo")).toContain("set logo_path = null");
  });

  it("lets members call the three changes, and no one the guard alone", () => {
    for (const signature of ["update_clinic_profile(jsonb)", "set_clinic_logo(text)", "clear_clinic_logo()"]) {
      expect(sql).toContain(`grant execute on function public.${signature} to authenticated;`);
    }
    expect(sql).toContain("revoke all on function public.require_clinic_settings() from public, anon, authenticated;");
    expect(sql).not.toContain("grant execute on function public.require_clinic_settings()");
  });

  it("keeps the logos in a private bucket held to the app's own limits (AGENTS.md §20)", () => {
    const bucket = /insert into storage\.buckets[\s\S]*?values \(([^;]*?)\)\n/.exec(sql)![1];
    expect(quoted(bucket)).toEqual([LOGO_BUCKET, LOGO_BUCKET, ...LOGO_MIME_TYPES]);
    expect(bucket).toContain(`false, ${MAX_LOGO_BYTES}, array`);
  });

  it("opens a clinic's folder to its members to read, and to settings.manage to store or remove", () => {
    const policy = (name: string) => new RegExp(`create policy ${name}[\\s\\S]*?;`).exec(sql)![0];
    const folder = "(storage.foldername(name))[2] = (select public.current_clinic_id())::text";
    expect(policy("clinic_logos_select")).toContain(folder);
    expect(policy("clinic_logos_select")).not.toContain("has_permission");
    expect(policy("clinic_logos_insert")).toContain(folder);
    expect(policy("clinic_logos_insert")).toContain("(select public.has_permission('settings.manage'))");
    expect(policy("clinic_logos_insert")).toContain("(select public.clinic_can_write())");
    expect(policy("clinic_logos_delete")).toContain("(select public.has_permission('settings.manage'))");
    // A new logo is always a new file, never an overwrite.
    expect(sql).not.toContain("on storage.objects\nfor update");
  });
});
