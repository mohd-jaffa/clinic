import { describe, expect, it } from "vitest";

import { isErrorMessageCode } from "@/constants/messages";
import { functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0014_owner_doctor.sql");

describe("0014 the owner's own doctor profile (plan §3.1; D96, D97)", () => {
  it("lets only the clinic's owner, as themselves, change it while the clinic can write", () => {
    const owner = functionBody(sql, "require_owner");
    expect(owner).toContain("m.clinic_id = public.current_clinic_id() and m.user_id = auth.uid()");
    expect(owner).toContain("m.role = 'OWNER' and m.status = 'ACTIVE'");
    expect(owner).toContain("perform public.require_clinic_write(owner.clinic_id);");
    for (const name of ["set_owner_sees_patients", "update_own_doctor"]) {
      expect(functionBody(sql, name), name).toContain("public.require_owner()");
    }
  });

  it("keeps the profile when turned off, and brings the same one back (D97)", () => {
    const sees = functionBody(sql, "set_owner_sees_patients");
    expect(sees).toContain("update public.doctors as d set active = p_sees where d.member_id = owner.id");
    expect(sees).toContain("if doctor.id is null and p_sees then");
    expect(sees).not.toMatch(/delete/);
  });

  it("changes details only while they see patients, refusing in the app's words", () => {
    expect(functionBody(sql, "update_own_doctor")).toContain("where d.member_id = owner.id and d.active");
    const codes = [...new Set([...sql.matchAll(/hint = '(\w+)'/g)].map((match) => match[1]))];
    expect(codes).toEqual(["AUTH_PERMISSION_DENIED", "OWNER_NOT_DOCTOR"]);
    for (const code of codes) expect(isErrorMessageCode(code), code).toBe(true);
  });

  it("lets members call the two changes, and no one call the owner check", () => {
    expect(sql).toContain("revoke all on function public.require_owner() from public, anon, authenticated;");
    expect(sql).toContain("grant execute on function public.set_owner_sees_patients(boolean) to authenticated;");
    expect(sql).toContain("grant execute on function public.update_own_doctor(jsonb) to authenticated;");
  });
});
