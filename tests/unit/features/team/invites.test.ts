// @vitest-environment node
import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamMember } from "@/features/team/types";
import type { Tenant } from "@/lib/supabase/tenant";
import type { InvitePayload } from "@/lib/validation";
import { fakeSupabase, postgrestError, type FakeAnswer, type RecordedQuery } from "@tests/support/supabase";

const mocks = vi.hoisted(() => ({
  findRecipient: vi.fn(),
  markSent: vi.fn(),
  sentTooRecently: vi.fn(),
  logActionSafe: vi.fn(),
  captureError: vi.fn(),
  sendInvite: vi.fn(),
  findMember: vi.fn(),
}));
vi.mock("@/features/auth/emails", () => ({
  findRecipient: mocks.findRecipient,
  markSent: mocks.markSent,
  sentTooRecently: mocks.sentTooRecently,
}));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe: mocks.logActionSafe }));
vi.mock("@/lib/audit/errorLog", () => ({ captureError: mocks.captureError }));
vi.mock("@/lib/mail/nodemailer.provider", () => ({
  createConfiguredMailService: () => ({ sendInvite: mocks.sendInvite }),
}));
vi.mock("@/lib/platform/settings", () => ({ getPlatformSettings: async () => ({ inviteValidDays: 7 }) }));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://clinicdesk.test" }) }));
vi.mock("@/features/team/api", () => ({ findMember: mocks.findMember }));

const { hashInviteToken, inviteMember, resendInvite, revokeInvite } = await import("@/features/team/invites");

const tenant: Tenant = {
  supabase: fakeSupabase().client,
  clinicId: "clinic-1",
  actorId: "owner-1",
  memberId: "member-0",
  role: "OWNER",
  permissions: [],
  doctorId: null,
};

const membership = { id: "member-9", invite_expires_at: "2026-10-10T06:00:00Z" };

/** The admin client: the account API, the team's functions, and the lookups an email makes. */
function adminWith({
  rpc = () => ({ data: membership }),
  answer = defaultAnswer,
  auth = {},
}: {
  rpc?: (name: string, args: unknown) => FakeAnswer;
  answer?: (query: RecordedQuery) => FakeAnswer;
  auth?: Record<string, unknown>;
} = {}) {
  const admin = {
    createUser: vi.fn(async () => ({ data: { user: { id: "user-9" } }, error: null })),
    deleteUser: vi.fn(async () => ({ error: null })),
    getUserById: vi.fn(async () => ({ data: { user: { id: "user-9", email_confirmed_at: null } }, error: null })),
    ...auth,
  };
  return { ...fakeSupabase({ rpc, answer, auth: { admin } }), admin };
}

function defaultAnswer(query: RecordedQuery): FakeAnswer {
  if (query.table === "clinics") return { data: { name: "Smile Care" } };
  if (query.table === "profiles") return { data: { full_name: "Asha Menon" } };
  return { count: 0 };
}

const meera: InvitePayload = {
  fullName: "Meera Pillai",
  email: "meera@example.com",
  role: "STAFF",
  jobTitle: "Front desk",
  permissions: ["patients.view"],
  doctor: null,
};

const invited: TeamMember = {
  id: "member-9",
  userId: "user-9",
  name: "Meera Pillai",
  email: "meera@example.com",
  role: "STAFF",
  status: "INVITED",
  jobTitle: "Front desk",
  permissions: ["patients.view"],
  inviteExpiresAt: "2026-10-04T06:00:00Z",
  inviteExpired: false,
  specialization: null,
  isDoctor: false,
};

/** The token the newest invite email's link carries. */
const sentToken = () => {
  const { inviteUrl } = mocks.sendInvite.mock.lastCall![0] as { inviteUrl: string };
  return new URL(inviteUrl).searchParams.get("token")!;
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.findRecipient.mockResolvedValue(null);
  mocks.sentTooRecently.mockReturnValue(false);
  mocks.findMember.mockResolvedValue(invited);
});

describe("hashInviteToken (D63)", () => {
  it("keeps a token as its SHA-256", () => {
    expect(hashInviteToken("abc")).toBe(createHash("sha256").update("abc").digest("hex"));
  });
});

describe("inviteMember (plan §8.4)", () => {
  it("makes the account, writes the invite as the server, audits it, and emails a link only it carries", async () => {
    const { client, admin, rpcs } = adminWith();
    const outcome = await inviteMember(tenant, client, meera, "req_1");

    expect(admin.createUser).toHaveBeenCalledWith({ email: "meera@example.com", email_confirm: false });
    const args = rpcs[0].args as Record<string, unknown>;
    expect(rpcs[0].name).toBe("invite_member");
    expect(args).toMatchObject({
      p_clinic_id: "clinic-1",
      p_actor_id: "owner-1",
      p_user_id: "user-9",
      p_role: "STAFF",
      p_job_title: "Front desk",
      p_permissions: ["patients.view"],
      p_doctor: null,
    });
    expect(args.p_token_hash).toBe(hashInviteToken(sentToken()));
    expect(sentToken()).toMatch(/^[\w-]{43}$/);

    expect(mocks.sendInvite).toHaveBeenCalledWith({
      to: "meera@example.com",
      name: "Meera Pillai",
      inviterName: "Asha Menon",
      clinicName: "Smile Care",
      role: "STAFF",
      inviteUrl: expect.stringMatching(/^https:\/\/clinicdesk\.test\/accept-invite\?token=/),
      validDays: 7,
    });
    expect(mocks.markSent).toHaveBeenCalledWith(client, expect.objectContaining({ id: "user-9" }));
    expect(mocks.logActionSafe).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({
        action: "CREATE",
        entityType: "clinic_members",
        entityId: "member-9",
        requestId: "req_1",
      }),
    );
    expect(outcome).toEqual({
      member: { ...invited, inviteExpiresAt: "2026-10-10T06:00:00Z" },
      emailSent: true,
    });
  });

  it("invites someone who has an account already as themselves, and a doctor with their details", async () => {
    mocks.findRecipient.mockResolvedValue({
      id: "user-5",
      fullName: "Rahul N",
      email: "rahul@example.com",
      emailLinkSentAt: null,
    });
    const { client, admin, rpcs } = adminWith();
    const { member } = await inviteMember(tenant, client, {
      ...meera,
      email: "rahul@example.com",
      role: "DOCTOR",
      jobTitle: null,
      doctor: { specialization: "Orthodontist", qualifications: null, registrationNumber: "KL-1", fee: 70_000 },
    });
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(rpcs[0].args).toMatchObject({
      p_user_id: "user-5",
      p_doctor: {
        specialization: "Orthodontist",
        qualifications: null,
        registration_number: "KL-1",
        consultation_fee_paise: 70_000,
      },
    });
    expect(member).toMatchObject({ userId: "user-5", name: "Rahul N", isDoctor: true, specialization: "Orthodontist" });
  });

  it("says so when the account could not be made", async () => {
    const { client } = adminWith({
      auth: { createUser: vi.fn(async () => ({ data: { user: null }, error: { message: "down" } })) },
    });
    await expect(inviteMember(tenant, client, meera)).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });

  it("removes an account it made when the invite is refused, and keeps a person's own", async () => {
    const refusal = { ...postgrestError("P0001"), hint: "TEAM_PERMISSION_NOT_HELD" };
    const made = adminWith({ rpc: () => ({ error: refusal }) });
    await expect(inviteMember(tenant, made.client, meera)).rejects.toMatchObject({ code: "TEAM_PERMISSION_NOT_HELD" });
    expect(made.admin.deleteUser).toHaveBeenCalledWith("user-9");

    mocks.findRecipient.mockResolvedValue({ id: "user-5", fullName: "Rahul", email: "r@x.co", emailLinkSentAt: null });
    const own = adminWith({ rpc: () => ({ error: postgrestError("23505") }) });
    await expect(inviteMember(tenant, own.client, meera)).rejects.toMatchObject({ code: "MEMBER_ALREADY_EXISTS" });
    expect(own.admin.deleteUser).not.toHaveBeenCalled();
    expect(mocks.logActionSafe).not.toHaveBeenCalled();
  });

  it("logs an account it could not remove again", async () => {
    const { client } = adminWith({
      rpc: () => ({ error: postgrestError("42501") }),
      auth: { deleteUser: vi.fn(async () => ({ error: { message: "down" } })) },
    });
    await expect(inviteMember(tenant, client, meera)).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    expect(mocks.captureError).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-9" }));
  });

  it("keeps the invite when its email could not go, and says so", async () => {
    mocks.sendInvite.mockRejectedValue(new Error("smtp down"));
    const { client } = adminWith();
    const outcome = await inviteMember(tenant, client, meera, "req_2");
    expect(outcome.emailSent).toBe(false);
    expect(mocks.markSent).not.toHaveBeenCalled();
    expect(mocks.captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Could not send an invite email", clinicId: "clinic-1", reference: "req_2" }),
    );

    const lost = adminWith({
      answer: (query) => (query.table === "clinics" ? { error: postgrestError("PGRST116") } : defaultAnswer(query)),
    });
    expect((await inviteMember(tenant, lost.client, meera)).emailSent).toBe(false);
  });
});

describe("resendInvite (plan §8.4)", () => {
  beforeEach(() => {
    mocks.findRecipient.mockResolvedValue({
      id: "user-9",
      fullName: "Meera Pillai",
      email: "meera@example.com",
      emailLinkSentAt: null,
    });
  });

  it("gives the invite a new link, audits the new expiry, and emails it", async () => {
    const { client, rpcs } = adminWith();
    expect(await resendInvite(tenant, client, "member-9", "req_3")).toEqual({
      ...invited,
      inviteExpiresAt: "2026-10-10T06:00:00Z",
    });
    expect(rpcs[0]).toMatchObject({
      name: "resend_invite",
      args: { p_clinic_id: "clinic-1", p_actor_id: "owner-1", p_member_id: "member-9" },
    });
    expect((rpcs[0].args as { p_token_hash: string }).p_token_hash).toBe(hashInviteToken(sentToken()));
    expect(mocks.logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "UPDATE",
      entityType: "clinic_members",
      entityId: "member-9",
      changes: { invite_expires_at: { from: "2026-10-04T06:00:00Z", to: "2026-10-10T06:00:00Z" } },
      requestId: "req_3",
    });
  });

  it("refuses an invite no longer open, and one sent a moment ago", async () => {
    mocks.findMember.mockResolvedValueOnce({ ...invited, status: "ACTIVE" });
    await expect(resendInvite(tenant, adminWith().client, "member-9")).rejects.toMatchObject({
      code: "INVITE_CHANGED",
      kind: "CONFLICT",
    });
    mocks.sentTooRecently.mockReturnValue(true);
    await expect(resendInvite(tenant, adminWith().client, "member-9")).rejects.toMatchObject({
      code: "INVITE_SENT_RECENTLY",
    });
  });

  it("says why the database refused it", async () => {
    const { client } = adminWith({ rpc: () => ({ error: { ...postgrestError("P0001"), hint: "INVITE_CHANGED" } }) });
    await expect(resendInvite(tenant, client, "member-9")).rejects.toMatchObject({ code: "INVITE_CHANGED" });
  });

  it("answers with the email's failure, the person waiting for it", async () => {
    mocks.sendInvite.mockRejectedValue(new Error("smtp down"));
    await expect(resendInvite(tenant, adminWith().client, "member-9", "req_4")).rejects.toMatchObject({
      kind: "EXTERNAL_SERVICE",
    });
    expect(mocks.captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Could not resend an invite email" }),
    );
  });
});

describe("revokeInvite (plan §8.4)", () => {
  it("revokes it as the server, audits it, and removes the account it made, never used", async () => {
    const { client, admin, rpcs } = adminWith();
    expect(await revokeInvite(tenant, client, "member-9", "req_5")).toEqual(invited);
    expect(rpcs[0]).toEqual({
      name: "revoke_invite",
      args: { p_clinic_id: "clinic-1", p_actor_id: "owner-1", p_member_id: "member-9" },
    });
    expect(mocks.logActionSafe).toHaveBeenCalledWith(
      tenant,
      expect.objectContaining({ action: "DELETE", requestId: "req_5" }),
    );
    expect(admin.deleteUser).toHaveBeenCalledWith("user-9");
  });

  it("keeps an account that is in another clinic, has been used, or is gone already", async () => {
    const elsewhere = adminWith({ answer: () => ({ count: 1 }) });
    await revokeInvite(tenant, elsewhere.client, "member-9");
    expect(elsewhere.admin.deleteUser).not.toHaveBeenCalled();

    const used = adminWith({
      auth: { getUserById: vi.fn(async () => ({ data: { user: { email_confirmed_at: "2026-01-01" } } })) },
    });
    await revokeInvite(tenant, used.client, "member-9");
    expect(used.admin.deleteUser).not.toHaveBeenCalled();

    const gone = adminWith({ auth: { getUserById: vi.fn(async () => ({ data: { user: null } })) } });
    await revokeInvite(tenant, gone.client, "member-9");
    expect(gone.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("refuses an invite no longer open, and says why the database refused it", async () => {
    mocks.findMember.mockResolvedValueOnce({ ...invited, status: "INACTIVE" });
    await expect(revokeInvite(tenant, adminWith().client, "member-9")).rejects.toMatchObject({
      code: "INVITE_CHANGED",
    });
    const { client } = adminWith({ rpc: () => ({ error: postgrestError("42501") }) });
    await expect(revokeInvite(tenant, client, "member-9")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});
