// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { fakeSupabase, postgrestError, type FakeAnswer } from "@tests/support/supabase";

const mocks = vi.hoisted(() => ({ freshSession: vi.fn(), logActionSafe: vi.fn() }));
vi.mock("@/features/auth/password", () => ({ freshSession: mocks.freshSession }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe: mocks.logActionSafe }));
vi.mock("@/features/auth/guard", () => ({
  tenantOf: (session: { profile: { id: string } }, membership: { clinicId: string }) => ({
    clinicId: membership.clinicId,
    actorId: session.profile.id,
  }),
}));

const { acceptInvite, previewInvite } = await import("@/features/team/accept");
const { hashInviteToken } = await import("@/features/team/invites");

const TOKEN = "t".repeat(43);
const found = {
  member_id: "member-9",
  user_id: "user-9",
  clinic_name: "Smile Care",
  role: "STAFF",
  full_name: "Meera Pillai",
  email: "meera@example.com",
  expired: false,
};
const payload = { token: TOKEN, fullName: "Meera P", phone: "+919876501234", password: "  a long one  " };

function adminWith({
  rpc = (name: string) => (name === "find_invite" ? { data: [found] } : { data: {} }),
  holder = null as unknown,
  unread = null as unknown,
  updateUserById = vi.fn(async () => ({ data: {}, error: null })),
}: {
  rpc?: (name: string, args: unknown) => FakeAnswer;
  holder?: unknown;
  unread?: unknown;
  updateUserById?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    ...fakeSupabase({
      rpc,
      answer: () => (unread ? { error: unread } : { data: holder }),
      auth: { admin: { updateUserById } },
    }),
    updateUserById,
  };
}

const anon = fakeSupabase().client;
const session = aSession({ profile: { ...aSession().profile, id: "user-9" } });

beforeEach(() => {
  mocks.freshSession.mockReset().mockResolvedValue(session);
  mocks.logActionSafe.mockReset();
});

describe("previewInvite (plan §8.5)", () => {
  it("names the clinic, the role and the person of the invite the token's hash finds", async () => {
    const { client, rpcs } = adminWith();
    expect(await previewInvite(client, { token: TOKEN })).toEqual({
      clinicName: "Smile Care",
      role: "STAFF",
      fullName: "Meera Pillai",
      email: "meera@example.com",
    });
    expect(rpcs[0]).toEqual({ name: "find_invite", args: { p_token_hash: hashInviteToken(TOKEN) } });
  });

  it("says a link names no open invite, or one run out, and a failure in the app's words", async () => {
    await expect(
      previewInvite(adminWith({ rpc: () => ({ data: [] }) }).client, { token: TOKEN }),
    ).rejects.toMatchObject({
      code: "INVITE_INVALID",
      kind: "VALIDATION",
    });
    await expect(
      previewInvite(adminWith({ rpc: () => ({ data: null }) }).client, { token: TOKEN }),
    ).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });
    await expect(
      previewInvite(adminWith({ rpc: () => ({ data: [{ ...found, expired: true }] }) }).client, { token: TOKEN }),
    ).rejects.toMatchObject({ code: "INVITE_EXPIRED", kind: "BUSINESS_RULE" });
    await expect(
      previewInvite(adminWith({ rpc: () => ({ error: postgrestError("42501") }) }).client, { token: TOKEN }),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("acceptInvite (plan §8.5, D91, D92)", () => {
  it("sets the password as typed and the mobile, joins the clinic, audits it and signs them in", async () => {
    const { client, rpcs, updateUserById, queries, argsOf } = adminWith();
    expect(await acceptInvite(anon, client, payload, "req_1")).toBe(session);

    expect(argsOf(queries[0], "eq")).toEqual([["phone", "+919876501234"]]);
    expect(argsOf(queries[0], "neq")).toEqual([["id", "user-9"]]);
    expect(updateUserById).toHaveBeenCalledWith("user-9", {
      password: "  a long one  ",
      phone: "+919876501234",
      phone_confirm: true,
      email_confirm: true,
    });
    expect(rpcs[1]).toEqual({
      name: "accept_invite",
      args: { p_token_hash: hashInviteToken(TOKEN), p_full_name: "Meera P", p_phone: "+919876501234" },
    });
    expect(mocks.freshSession).toHaveBeenCalledWith(anon, client, "meera@example.com", "  a long one  ");
    expect(mocks.logActionSafe).toHaveBeenCalledWith(
      { clinicId: "clinic-1", actorId: "user-9" },
      {
        action: "STATUS_CHANGE",
        entityType: "clinic_members",
        entityId: "member-9",
        changes: { status: { from: "INVITED", to: "ACTIVE" } },
        requestId: "req_1",
      },
    );
  });

  it("refuses a mobile another account has, before changing anything", async () => {
    const { client, updateUserById } = adminWith({ holder: { id: "user-1" } });
    await expect(acceptInvite(anon, client, payload)).rejects.toMatchObject({ code: "AUTH_PHONE_ALREADY_EXISTS" });
    expect(updateUserById).not.toHaveBeenCalled();
    await expect(
      acceptInvite(anon, adminWith({ unread: postgrestError("42501") }).client, payload),
    ).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });

  it("says when the account could not be changed, or the invite not accepted", async () => {
    const refused = adminWith({ updateUserById: vi.fn(async () => ({ error: { message: "down" } })) });
    await expect(acceptInvite(anon, refused.client, payload)).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });

    const raced = adminWith({
      rpc: (name) => (name === "find_invite" ? { data: [found] } : { error: postgrestError("23505") }),
    });
    await expect(acceptInvite(anon, raced.client, payload)).rejects.toMatchObject({
      code: "AUTH_PHONE_ALREADY_EXISTS",
    });

    const spent = adminWith({
      rpc: (name) =>
        name === "find_invite" ? { data: [found] } : { error: { ...postgrestError("P0001"), hint: "INVITE_INVALID" } },
    });
    await expect(acceptInvite(anon, spent.client, payload)).rejects.toMatchObject({ code: "INVITE_INVALID" });
    expect(mocks.freshSession).not.toHaveBeenCalled();
  });
});
