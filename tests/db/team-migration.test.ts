import { describe, expect, it } from "vitest";

import { isErrorMessageCode } from "@/constants/messages";
import { functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0012_team.sql");
const FUNCTIONS = [
  "team_actor(uuid, uuid)",
  "check_grantable(public.clinic_members, text[])",
  "invite_expiry()",
  "invite_member(uuid, uuid, uuid, text, text, text, text, text[], jsonb, text)",
  "resend_invite(uuid, uuid, uuid, text)",
  "revoke_invite(uuid, uuid, uuid)",
  "find_invite(text)",
  "accept_invite(text, text, text)",
];

describe("0012 inviting the team (plan §8.3 – §8.5; D63)", () => {
  it("keeps only a token's hash, while the invite is open, one link to one invite", () => {
    expect(sql).toContain("add column invite_token_hash text\n  check (invite_token_hash ~ '^[0-9a-f]{64}$');");
    expect(sql).toContain("check ((status = 'INVITED') = (invite_token_hash is not null));");
    expect(sql).toContain(
      "create unique index clinic_members_invite_token_unique on public.clinic_members (invite_token_hash)\n  where invite_token_hash is not null;",
    );
  });

  it("acts only for a member who manages the team of a clinic that can write", () => {
    const actor = functionBody(sql, "team_actor");
    expect(actor).toContain("m.clinic_id = p_clinic_id and m.user_id = p_actor_id and m.status = 'ACTIVE'");
    expect(actor).toContain("actor.role = 'OWNER' or 'team.manage' = any (actor.permissions)");
    expect(actor).toContain("perform public.require_clinic_write(p_clinic_id);");
    for (const name of ["invite_member", "resend_invite", "revoke_invite"]) {
      expect(functionBody(sql, name), name).toContain("public.team_actor(p_clinic_id, p_actor_id)");
    }
  });

  it("grants nothing the inviter does not hold, and team.manage only from the owner", () => {
    const grantable = functionBody(sql, "check_grantable");
    expect(grantable).toContain("if p_actor.role = 'OWNER' then");
    expect(grantable).toContain("'team.manage' = any (p_permissions)");
    expect(grantable).toContain("not (p_permissions <@ p_actor.permissions)");
    expect(functionBody(sql, "invite_member")).toContain("perform public.check_grantable(actor, p_permissions);");
  });

  it("invites one person into one clinic, and no platform account", () => {
    const invite = functionBody(sql, "invite_member");
    expect(invite).toContain("m.user_id = p_user_id and m.status in ('INVITED', 'ACTIVE')");
    expect(invite).toContain("p.id = p_user_id and p.platform_role is not null");
    expect(invite).toContain("public.invite_expiry(), p_token_hash");
    expect(functionBody(sql, "invite_expiry")).toContain("make_interval(days => s.invite_valid_days)");
  });

  it("accepts a current link once", () => {
    const accept = functionBody(sql, "accept_invite");
    expect(accept).toContain("m.invite_token_hash = p_token_hash and m.status = 'INVITED'");
    expect(accept).toContain("if member.invite_expires_at < now() then");
    expect(accept).toContain("set status = 'ACTIVE', joined_at = now(), invite_token_hash = null");
  });

  it("refuses with the app's own codes", () => {
    const codes = [...new Set([...sql.matchAll(/hint = '(\w+)'/g)].map((match) => match[1]))];
    expect(codes).toEqual([
      "AUTH_PERMISSION_DENIED",
      "TEAM_MANAGE_OWNER_ONLY",
      "TEAM_PERMISSION_NOT_HELD",
      "INVITE_EMAIL_NOT_ALLOWED",
      "MEMBER_ALREADY_EXISTS",
      "MEMBER_DEACTIVATED_HERE",
      "INVITE_CHANGED",
      "INVITE_INVALID",
      "INVITE_EXPIRED",
    ]);
    for (const code of codes) expect(isErrorMessageCode(code), code).toBe(true);
  });

  it("is the server's alone: no client calls any of it", () => {
    for (const signature of FUNCTIONS) {
      expect(sql).toMatch(
        new RegExp(
          `revoke all on function public\\.${signature.replace(/[().[\]]/g, "\\$&")}\\s+from public, anon, authenticated;`,
        ),
      );
    }
    expect(sql).not.toMatch(/grant execute/);
  });
});
