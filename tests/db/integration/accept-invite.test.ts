import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PERMISSION_PRESET_SETS } from "@/constants/permissions";
import { acceptInvite, previewInvite } from "@/features/team/accept";
import { inviteMember } from "@/features/team/invites";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { InvitePayload } from "@/lib/validation";
import {
  addMember,
  admin,
  aMobileNumber,
  anEmail,
  aPassword,
  registerClinic,
  removeAll,
  setMemberStatus,
  signIn,
  type TestClinic,
} from "@tests/support/integration";
import { latestMessageTo } from "@tests/support/mailpit";

/**
 * Accepting an invite against the local Supabase (plan §8.5; R3.5, D91,
 * D92): the link opens onto the clinic and the role; accepting sets the
 * password and mobile, joins the clinic and signs the person in — once;
 * someone with an account already sets a new password too; a link run out,
 * or a mobile another account has, is refused in words.
 */
let clinic: TestClinic;

const invitation = (overrides: Partial<InvitePayload> = {}): InvitePayload => ({
  fullName: "Meera Pillai",
  email: anEmail(),
  role: "STAFF",
  jobTitle: "Front desk",
  permissions: [...PERMISSION_PRESET_SETS.RECEPTIONIST.permissions],
  doctor: null,
  ...overrides,
});

/** Invites someone and hands back the token their email's link carries. */
async function invite(overrides: Partial<InvitePayload> = {}) {
  const sent = invitation(overrides);
  const { member } = await inviteMember(clinic.owner.tenant, admin(), sent);
  const { text } = await latestMessageTo(sent.email);
  return { member, email: sent.email, token: /\/accept-invite#token=([\w-]+)/.exec(text)![1] };
}

const phone = () => `+91${aMobileNumber()}`;

beforeAll(async () => {
  clinic = await registerClinic({ clinicName: "Smile Care" });
});

afterAll(removeAll);

describe("the link (plan §8.5)", () => {
  it("opens onto the clinic, the role and the person", async () => {
    const { token, email } = await invite({
      fullName: "Anu Thomas",
      role: "DOCTOR",
      jobTitle: null,
      doctor: {
        specialization: null,
        qualifications: null,
        registrationNumber: null,
        fee: null,
      },
    });
    expect(await previewInvite(admin(), { token })).toEqual({
      clinicName: "Smile Care",
      role: "DOCTOR",
      fullName: "Anu Thomas",
      email,
    });
    await expect(previewInvite(admin(), { token: "x".repeat(43) })).rejects.toMatchObject({ code: "INVITE_INVALID" });
  });
});

describe("accepting (plan §8.5)", () => {
  it("sets the password and mobile, joins the clinic, audits it and signs them in — once", async () => {
    const { token, email, member } = await invite();
    const mobile = phone();
    const password = aPassword();
    const session = await acceptInvite(
      createSupabaseAnonClient(),
      admin(),
      { token, fullName: "Meera P", phone: mobile, password },
      "req_accept_1",
    );
    expect(session.profile).toMatchObject({ email, fullName: "Meera P", phone: mobile });
    expect(session.membership).toMatchObject({
      clinicId: clinic.clinicId,
      role: "STAFF",
      jobTitle: "Front desk",
      permissions: [...PERMISSION_PRESET_SETS.RECEPTIONIST.permissions],
    });

    // Their own sign-in works, by email and by mobile.
    expect((await signIn(email, password)).membership?.clinicId).toBe(clinic.clinicId);
    expect((await signIn(mobile.slice(3), password)).profile.email).toBe(email);

    const { data: audit } = await admin()
      .from("audit_logs")
      .select("action, entity_id, actor_id, changes")
      .eq("request_id", "req_accept_1")
      .single();
    expect(audit).toEqual({
      action: "STATUS_CHANGE",
      entity_id: member.id,
      actor_id: member.userId,
      changes: { status: { from: "INVITED", to: "ACTIVE" } },
    });

    await expect(
      acceptInvite(createSupabaseAnonClient(), admin(), { token, fullName: "x", phone: phone(), password }),
    ).rejects.toMatchObject({ code: "INVITE_INVALID" });
  });

  it("lets someone with an account already set a new password (D91)", async () => {
    const leaving = await addMember((await registerClinic()).clinicId, { permissions: ["patients.view"] });
    await setMemberStatus(leaving.memberId, "INACTIVE");
    const { token } = await invite({ email: leaving.email });
    const password = aPassword();
    const session = await acceptInvite(createSupabaseAnonClient(), admin(), {
      token,
      fullName: "Test staff",
      phone: phone(),
      password,
    });
    expect(session.membership?.clinicId).toBe(clinic.clinicId);
    await expect(signIn(leaving.email, leaving.password)).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    expect((await signIn(leaving.email, password)).profile.id).toBe(leaving.userId);
  });

  it("refuses a link that has run out, and a mobile another account has", async () => {
    const expired = await invite();
    await admin()
      .from("clinic_members")
      .update({ invite_expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", expired.member.id);
    await expect(previewInvite(admin(), { token: expired.token })).rejects.toMatchObject({
      code: "INVITE_EXPIRED",
      kind: "BUSINESS_RULE",
    });
    await expect(
      acceptInvite(createSupabaseAnonClient(), admin(), {
        token: expired.token,
        fullName: "x",
        phone: phone(),
        password: aPassword(),
      }),
    ).rejects.toMatchObject({ code: "INVITE_EXPIRED" });

    const taken = await invite();
    await expect(
      acceptInvite(createSupabaseAnonClient(), admin(), {
        token: taken.token,
        fullName: "x",
        phone: clinic.owner.phone,
        password: aPassword(),
      }),
    ).rejects.toMatchObject({ code: "AUTH_PHONE_ALREADY_EXISTS", kind: "CONFLICT" });
    // Still open, to accept with a mobile of their own.
    expect(await previewInvite(admin(), { token: taken.token })).toMatchObject({ clinicName: "Smile Care" });
  });
});
