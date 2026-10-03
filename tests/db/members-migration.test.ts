import { describe, expect, it } from "vitest";

import { isErrorMessageCode } from "@/constants/messages";
import { functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0013_members.sql");

describe("0013 changing the team (plan §8.2, §8.6; D93 – D95)", () => {
  it("acts as the signed-in member, who must manage the team", () => {
    for (const name of ["update_member", "set_member_active"]) {
      const body = functionBody(sql, name);
      expect(body, name).toContain("public.team_actor(public.current_clinic_id(), auth.uid())");
      expect(body, name).toContain("public.team_target(actor, p_member_id)");
    }
  });

  it("changes only a joined member of the clinic: never the owner, never oneself, and for a manager only those within their access", () => {
    const target = functionBody(sql, "team_target");
    expect(target).toContain("m.id = p_member_id and m.clinic_id = p_actor.clinic_id");
    expect(target).toContain("for update");
    expect(target).toContain("if target.role = 'OWNER' then");
    expect(target).toContain("if target.id = p_actor.id then");
    expect(target).toContain("if target.status = 'INVITED' then");
    expect(target).toContain(
      "p_actor.role <> 'OWNER'\n     and ('team.manage' = any (target.permissions) or not (target.permissions <@ p_actor.permissions))",
    );
  });

  it("gives only what may be given, and keeps each role's own fields (D95)", () => {
    const update = functionBody(sql, "update_member");
    expect(update).toContain("perform public.check_grantable(actor, granted);");
    expect(update).toContain("(p_changes ? 'job_title' and target.role <> 'STAFF')");
    expect(update).toContain("(p_changes ? 'doctor' and target.role <> 'DOCTOR')");
  });

  it("reactivates no one in another clinic, and records who deactivated", () => {
    const active = functionBody(sql, "set_member_active");
    expect(active).toContain("m.user_id = target.user_id and m.id <> target.id and m.status in ('INVITED', 'ACTIVE')");
    expect(active).toContain("set status = 'INACTIVE', deactivated_at = now(), deactivated_by = actor.user_id");
  });

  it("refuses with the app's own codes", () => {
    const codes = [...new Set([...sql.matchAll(/hint = '(\w+)'/g)].map((match) => match[1]))];
    expect(codes).toEqual([
      "RECORD_NOT_FOUND",
      "TEAM_OWNER_UNCHANGEABLE",
      "TEAM_NOT_YOURSELF",
      "MEMBER_STILL_INVITED",
      "TEAM_MEMBER_NOT_YOURS",
      "MEMBER_ALREADY_EXISTS",
    ]);
    for (const code of codes) expect(isErrorMessageCode(code), code).toBe(true);
  });

  it("lets members call the two changes, and no one call the target check", () => {
    expect(sql).toContain(
      "revoke all on function public.team_target(public.clinic_members, uuid) from public, anon, authenticated;",
    );
    expect(sql).toContain("grant execute on function public.update_member(uuid, jsonb) to authenticated;");
    expect(sql).toContain("grant execute on function public.set_member_active(uuid, boolean) to authenticated;");
  });
});
