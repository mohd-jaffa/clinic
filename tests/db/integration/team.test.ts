import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PERMISSION_PRESET_SETS } from "@/constants/permissions";
import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { listDoctors, listTeam } from "@/features/team/api";
import { hashInviteToken, inviteMember, resendInvite, revokeInvite } from "@/features/team/invites";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import type { InvitePayload } from "@/lib/validation";
import {
  addMember,
  admin,
  aMobileNumber,
  anEmail,
  makeDeveloper,
  registerClinic,
  removeAll,
  setMemberStatus,
  setValidUntil,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";
import { latestMessageTo, messagesTo } from "@tests/support/mailpit";

/**
 * Inviting the team against the local Supabase (plan §8.3 – §8.5; R3.4, D63,
 * D88 – D90): the owner invites a doctor and a receptionist, each emailed a
 * link of their own whose token is kept only as a hash; a member with
 * team.manage invites within what they hold; one clinic per person; resend
 * makes a new link and kills the old; revoke removes the invite and the
 * account it made; a link is accepted once, while it lasts. And none of it
 * can be called by a client.
 */
let clinic: TestClinic;
let other: TestClinic;
let manager: SignedIn & { memberId: string };
let receptionist: SignedIn & { memberId: string };

const receptionistInvite = (overrides: Partial<InvitePayload> = {}): InvitePayload => ({
  fullName: "Meera Pillai",
  email: anEmail(),
  role: "STAFF",
  jobTitle: "Front desk",
  permissions: [...PERMISSION_PRESET_SETS.RECEPTIONIST.permissions],
  doctor: null,
  ...overrides,
});

/** The token in the newest invite email to an address. */
async function tokenSentTo(email: string): Promise<string> {
  const { text } = await latestMessageTo(email);
  return /\/accept-invite\?token=([\w-]+)/.exec(text)![1];
}

const membershipOf = async (id: string) =>
  (await admin().from("clinic_members").select("*").eq("id", id).single()).data as Record<string, unknown>;

beforeAll(async () => {
  [clinic, other] = await Promise.all([registerClinic({ clinicName: "Smile Care" }), registerClinic()]);
  [manager, receptionist] = await Promise.all([
    addMember(clinic.clinicId, {
      permissions: ["team.manage", "patients.view", "patients.create", "appointments.view"],
    }),
    addMember(clinic.clinicId, { permissions: ["patients.view"] }),
  ]);
});

afterAll(removeAll);

describe("inviting (plan §8.4)", () => {
  it("invites a doctor with their details, emails a link of their own, and keeps only its hash", async () => {
    const email = anEmail();
    const { member, emailSent } = await inviteMember(
      clinic.owner.tenant,
      admin(),
      {
        fullName: "Rahul Nair",
        email,
        role: "DOCTOR",
        jobTitle: null,
        permissions: [...PERMISSION_PRESET_SETS.DOCTOR.permissions],
        doctor: { specialization: "Orthodontist", qualifications: "BDS, MDS", registrationNumber: null, fee: 70_000 },
      },
      "req_invite_1",
    );
    expect(emailSent).toBe(true);
    expect(member).toMatchObject({ name: "Rahul Nair", email, role: "DOCTOR", status: "INVITED", isDoctor: true });

    const token = await tokenSentTo(email);
    const { subject, text } = await latestMessageTo(email);
    expect(subject).toBe("You're invited to Smile Care on ClinicDesk");
    expect(text).toContain("as a doctor");
    const row = await membershipOf(member.id);
    expect(row).toMatchObject({
      status: "INVITED",
      invite_token_hash: hashInviteToken(token),
      invited_by: clinic.owner.userId,
    });
    expect(JSON.stringify(row)).not.toContain(token);
    const days = (Date.parse(row.invite_expires_at as string) - Date.now()) / 86_400_000;
    expect(days).toBeCloseTo(PLATFORM_SETTING_DEFAULTS.inviteValidDays, 1);

    const { data: doctor } = await admin()
      .from("doctors")
      .select("specialization, qualifications, consultation_fee_paise")
      .eq("member_id", member.id)
      .single();
    expect(doctor).toEqual({
      specialization: "Orthodontist",
      qualifications: "BDS, MDS",
      consultation_fee_paise: 70_000,
    });
    // Not a doctor anyone can book until they have joined.
    expect((await listDoctors(clinic.owner.tenant)).map(({ name }) => name)).not.toContain("Rahul Nair");

    const { data: audit } = await admin()
      .from("audit_logs")
      .select("action, entity_type, entity_id, actor_id, changes")
      .eq("request_id", "req_invite_1")
      .single();
    expect(audit).toMatchObject({
      action: "CREATE",
      entity_type: "clinic_members",
      entity_id: member.id,
      actor_id: clinic.owner.userId,
      changes: { email: { from: null, to: email }, role: { from: null, to: "DOCTOR" } },
    });
  });

  it("lists the team with the invite — the owner first", async () => {
    const team = await listTeam(clinic.owner.tenant);
    expect(team[0]).toMatchObject({ role: "OWNER", userId: clinic.owner.userId, status: "ACTIVE" });
    expect(team.find(({ name }) => name === "Rahul Nair")).toMatchObject({
      status: "INVITED",
      specialization: "Orthodontist",
    });
    expect(team.every(({ inviteExpiresAt, status }) => (status === "INVITED") === (inviteExpiresAt !== null))).toBe(
      true,
    );
  });

  it("lets a member with team.manage invite within what they hold, never team.manage itself", async () => {
    const { member } = await inviteMember(
      manager.tenant!,
      admin(),
      receptionistInvite({ permissions: ["patients.view", "patients.create"] }),
    );
    expect(member.status).toBe("INVITED");

    await expect(inviteMember(manager.tenant!, admin(), receptionistInvite())).rejects.toMatchObject({
      code: "TEAM_PERMISSION_NOT_HELD",
      kind: "BUSINESS_RULE",
    });
    await expect(
      inviteMember(manager.tenant!, admin(), receptionistInvite({ permissions: ["team.manage"] })),
    ).rejects.toMatchObject({ code: "TEAM_MANAGE_OWNER_ONLY" });
    await expect(inviteMember(receptionist.tenant!, admin(), receptionistInvite())).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });

  it("removes the account it made when the invite is refused, so the email is free again", async () => {
    const invite = receptionistInvite({ permissions: ["team.manage"] });
    await expect(inviteMember(manager.tenant!, admin(), invite)).rejects.toMatchObject({
      code: "TEAM_MANAGE_OWNER_ONLY",
    });
    const { data } = await admin().from("profiles").select("id").eq("email", invite.email);
    expect(data).toEqual([]);
    const { data: users } = await admin().auth.admin.listUsers({ perPage: 1000 });
    expect(users.users.map((user) => user.email)).not.toContain(invite.email);
  });

  it("invites one person into one clinic (D23), and a former member is reactivated instead", async () => {
    await expect(
      inviteMember(other.owner.tenant, admin(), receptionistInvite({ email: receptionist.email })),
    ).rejects.toMatchObject({ code: "MEMBER_ALREADY_EXISTS", kind: "CONFLICT" });
    await expect(
      inviteMember(other.owner.tenant, admin(), receptionistInvite({ email: clinic.owner.email })),
    ).rejects.toMatchObject({ code: "MEMBER_ALREADY_EXISTS" });

    const leaving = await addMember(clinic.clinicId, { permissions: ["patients.view"] });
    await setMemberStatus(leaving.memberId, "INACTIVE");
    await expect(
      inviteMember(clinic.owner.tenant, admin(), receptionistInvite({ email: leaving.email })),
    ).rejects.toMatchObject({ code: "MEMBER_DEACTIVATED_HERE" });
    // Someone who left another clinic may join this one, with their own account.
    const { member } = await inviteMember(other.owner.tenant, admin(), receptionistInvite({ email: leaving.email }));
    expect(member).toMatchObject({ userId: leaving.userId, name: "Test staff" });

    const developer = await makeDeveloper();
    await expect(
      inviteMember(clinic.owner.tenant, admin(), receptionistInvite({ email: developer.email })),
    ).rejects.toMatchObject({ code: "INVITE_EMAIL_NOT_ALLOWED" });
  });
});

describe("resending and revoking (plan §8.4)", () => {
  it("resends with a new link that replaces the old, not twice in a moment", async () => {
    const invite = receptionistInvite();
    const { member } = await inviteMember(clinic.owner.tenant, admin(), invite);
    const first = await tokenSentTo(invite.email);
    await expect(resendInvite(clinic.owner.tenant, admin(), member.id)).rejects.toMatchObject({
      code: "INVITE_SENT_RECENTLY",
    });

    await admin().from("profiles").update({ email_link_sent_at: null }).eq("id", member.userId);
    await admin()
      .from("clinic_members")
      .update({ invite_expires_at: new Date(Date.now() + 3_600_000).toISOString() })
      .eq("id", member.id);
    const renewed = await resendInvite(clinic.owner.tenant, admin(), member.id, "req_invite_2");
    expect(Date.parse(renewed.inviteExpiresAt!)).toBeGreaterThan(Date.now() + 86_400_000);
    await expect.poll(async () => (await messagesTo(invite.email)).length).toBe(2);
    const second = await tokenSentTo(invite.email);
    expect(second).not.toBe(first);
    expect((await membershipOf(member.id)).invite_token_hash).toBe(hashInviteToken(second));
    const { data: audit } = await admin().from("audit_logs").select("action").eq("request_id", "req_invite_2").single();
    expect(audit).toEqual({ action: "UPDATE" });
  });

  it("revokes an invite and the account it made, and acts on no one else's", async () => {
    const invite = receptionistInvite();
    const { member } = await inviteMember(clinic.owner.tenant, admin(), invite);
    await expect(revokeInvite(other.owner.tenant, admin(), member.id)).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
    await expect(revokeInvite(clinic.owner.tenant, admin(), manager.memberId)).rejects.toMatchObject({
      code: "INVITE_CHANGED",
    });

    expect(await revokeInvite(manager.tenant!, admin(), member.id, "req_invite_3")).toMatchObject({ id: member.id });
    expect((await admin().from("clinic_members").select("id").eq("id", member.id)).data).toEqual([]);
    expect((await admin().from("profiles").select("id").eq("id", member.userId)).data).toEqual([]);
    const { data: audit } = await admin().from("audit_logs").select("action").eq("request_id", "req_invite_3").single();
    expect(audit).toEqual({ action: "DELETE" });
  });

  it("keeps a person's own account when their invite is revoked", async () => {
    const leaving = await addMember(other.clinicId, { permissions: ["patients.view"] });
    await setMemberStatus(leaving.memberId, "INACTIVE");
    const { member } = await inviteMember(clinic.owner.tenant, admin(), receptionistInvite({ email: leaving.email }));
    await revokeInvite(clinic.owner.tenant, admin(), member.id);
    expect((await admin().from("profiles").select("id").eq("id", leaving.userId)).data).toHaveLength(1);
  });
});

describe("accepting (plan §8.5)", () => {
  it("finds the invite a link names, accepts it once, and joins the clinic", async () => {
    const invite = receptionistInvite({ fullName: "Anu Thomas" });
    const { member } = await inviteMember(clinic.owner.tenant, admin(), invite);
    const hash = hashInviteToken(await tokenSentTo(invite.email));
    const phone = `+91${aMobileNumber()}`;

    const { data: found } = await admin().rpc("find_invite", { p_token_hash: hash });
    expect(found).toEqual([
      {
        member_id: member.id,
        user_id: member.userId,
        clinic_name: "Smile Care",
        role: "STAFF",
        full_name: "Anu Thomas",
        email: invite.email,
        expired: false,
      },
    ]);

    const { data: accepted, error } = await admin().rpc("accept_invite", {
      p_token_hash: hash,
      p_full_name: "Anu Thomas K",
      p_phone: phone,
    });
    expect(error).toBeNull();
    expect(accepted).toMatchObject({ status: "ACTIVE", invite_token_hash: null });
    const { data: profile } = await admin()
      .from("profiles")
      .select("full_name, phone")
      .eq("id", member.userId)
      .single();
    expect(profile).toEqual({ full_name: "Anu Thomas K", phone });

    const again = await admin().rpc("accept_invite", { p_token_hash: hash, p_full_name: "x", p_phone: null });
    expect(again.error?.hint).toBe("INVITE_INVALID");
    expect((await admin().rpc("find_invite", { p_token_hash: hash })).data).toEqual([]);
  });

  it("refuses a link that has run out, or was replaced", async () => {
    const invite = receptionistInvite();
    const { member } = await inviteMember(clinic.owner.tenant, admin(), invite);
    const hash = hashInviteToken(await tokenSentTo(invite.email));
    await admin()
      .from("clinic_members")
      .update({ invite_expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", member.id);
    expect((await admin().rpc("find_invite", { p_token_hash: hash })).data).toMatchObject([{ expired: true }]);
    const expired = await admin().rpc("accept_invite", { p_token_hash: hash, p_full_name: "x", p_phone: null });
    expect(expired.error?.hint).toBe("INVITE_EXPIRED");
  });
});

describe("guarded", () => {
  it("lets no client call the team's functions, not even the owner", async () => {
    const calls = [
      ["invite_member", { p_clinic_id: clinic.clinicId, p_actor_id: clinic.owner.userId }],
      [
        "resend_invite",
        { p_clinic_id: clinic.clinicId, p_actor_id: clinic.owner.userId, p_member_id: manager.memberId },
      ],
      [
        "revoke_invite",
        { p_clinic_id: clinic.clinicId, p_actor_id: clinic.owner.userId, p_member_id: manager.memberId },
      ],
      ["find_invite", { p_token_hash: "0".repeat(64) }],
      ["accept_invite", { p_token_hash: "0".repeat(64), p_full_name: "x", p_phone: null }],
    ] as const;
    for (const [name, args] of calls) {
      const { error } = await clinic.owner.tenant.supabase.rpc(name, args);
      expect(error?.code, name).toMatch(/^(42501|PGRST202)$/);
    }
  });

  it("invites no one into a view-only clinic", async () => {
    await setValidUntil(other.clinicId, addDaysKey(todayKey(), -PLATFORM_SETTING_DEFAULTS.graceDays - 30));
    await expect(inviteMember(other.owner.tenant, admin(), receptionistInvite())).rejects.toMatchObject({
      code: "CLINIC_PLAN_EXPIRED",
    });
  });
});
