import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import { aSession } from "@tests/support/auth";
import { authError, fakeSupabase } from "@tests/support/supabase";

const { emails, captureError, loadSessionContext } = vi.hoisted(() => ({
  emails: { findRecipient: vi.fn(), sentTooRecently: vi.fn(() => false), sendPasswordResetEmail: vi.fn() },
  captureError: vi.fn(async () => undefined),
  loadSessionContext: vi.fn(),
}));
vi.mock("@/features/auth/emails", () => emails);
vi.mock("@/lib/audit/errorLog", () => ({ captureError }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), loadSessionContext }));

const { changePassword, completePasswordReset, requestPasswordReset } = await import("@/features/auth/password");

const recipient = { id: "user-1", fullName: "Asha", email: "asha@example.com", emailLinkSentAt: null };
const session = aSession();
const supabaseSession = { access_token: "fresh", refresh_token: "fresh-r", expires_at: 1, user: { id: "user-1" } };

/** The server's client: setting a password, ending sessions. */
function server({ update = null as unknown, signOut = null as unknown } = {}) {
  const updateUserById = vi.fn(async () => ({ error: update }));
  const signOutFn = vi.fn(async () => ({ error: signOut }));
  return {
    client: fakeSupabase({ auth: { admin: { updateUserById, signOut: signOutFn } } }).client,
    updateUserById,
    signOut: signOutFn,
  };
}

/** The caller's client: signing in answers each call in turn. */
function caller(...answers: { session?: unknown; error?: unknown }[]) {
  const signInWithPassword = vi.fn();
  for (const { session: given = null, error = null } of answers) {
    signInWithPassword.mockResolvedValueOnce({ data: { session: given, user: null }, error });
  }
  const setSession = vi.fn(async () => ({
    data: {
      session: { ...supabaseSession, user: { id: "user-1", email: "asha@example.com" } },
      user: { id: "user-1" },
    },
    error: null,
  }));
  return { client: fakeSupabase({ auth: { signInWithPassword, setSession } }).client, signInWithPassword, setSession };
}

beforeEach(() => {
  vi.restoreAllMocks();
  emails.findRecipient.mockReset();
  emails.sentTooRecently.mockReset();
  emails.sentTooRecently.mockReturnValue(false);
  emails.sendPasswordResetEmail.mockReset();
  captureError.mockClear();
  loadSessionContext.mockReset();
  loadSessionContext.mockResolvedValue({
    profile: session.profile,
    membership: session.membership,
    subscription: session.subscription,
  });
});

describe("requestPasswordReset", () => {
  it("sends a reset link to an account's address", async () => {
    emails.findRecipient.mockResolvedValue(recipient);
    await expect(requestPasswordReset(server().client, { email: "asha@example.com" })).resolves.toEqual({
      accepted: true,
    });
    expect(emails.sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), recipient);
  });

  it("answers the same for no account, and for one sent a link moments ago, sending nothing", async () => {
    emails.findRecipient.mockResolvedValue(null);
    await expect(requestPasswordReset(server().client, { email: "x@y.co" })).resolves.toEqual({ accepted: true });
    emails.findRecipient.mockResolvedValue(recipient);
    emails.sentTooRecently.mockReturnValue(true);
    await expect(requestPasswordReset(server().client, { email: "asha@example.com" })).resolves.toEqual({
      accepted: true,
    });
    expect(emails.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("answers the same when the email could not go, logging it", async () => {
    emails.findRecipient.mockResolvedValue(recipient);
    emails.sendPasswordResetEmail.mockRejectedValue(new Error("smtp down"));
    await expect(requestPasswordReset(server().client, { email: "asha@example.com" })).resolves.toEqual({
      accepted: true,
    });
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Could not send the password reset email", userId: "user-1" }),
    );
  });
});

describe("completePasswordReset", () => {
  it("sets the password for the link's account, counts the address confirmed, and signs in afresh", async () => {
    const admin = server();
    const anon = caller({ session: supabaseSession });
    const fresh = await completePasswordReset(anon.client, admin.client, {
      accessToken: "a",
      refreshToken: "r",
      password: "new pass",
    });

    expect(admin.updateUserById).toHaveBeenCalledWith("user-1", { password: "new pass", email_confirm: true });
    expect(anon.signInWithPassword).toHaveBeenCalledWith({ email: "asha@example.com", password: "new pass" });
    expect(admin.signOut).toHaveBeenCalledWith("fresh", "others");
    expect(fresh).toMatchObject({
      accessToken: "fresh",
      refreshToken: "fresh-r",
      membership: { clinicId: "clinic-1" },
    });
  });

  it("fails when Supabase will not set it, or will not sign in with it", async () => {
    const tokens = { accessToken: "a", refreshToken: "r", password: "new pass" };
    await expect(
      completePasswordReset(caller().client, server({ update: authError("weak_password") }).client, tokens),
    ).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
    await expect(
      completePasswordReset(caller({ error: authError("unexpected_failure") }).client, server().client, tokens),
    ).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });

  it("signs in with no email when the link's account has none", async () => {
    const anon = caller({ session: supabaseSession });
    anon.setSession.mockResolvedValue({
      data: { session: { ...supabaseSession, user: { id: "user-1" } }, user: { id: "user-1" } },
      error: null,
    } as never);
    await completePasswordReset(anon.client, server().client, {
      accessToken: "a",
      refreshToken: "r",
      password: "p4ssword",
    });
    expect(anon.signInWithPassword).toHaveBeenCalledWith({ email: "", password: "p4ssword" });
  });
});

describe("changePassword", () => {
  const payload = { currentPassword: "old pass", newPassword: "new pass" };

  it("checks the current password, sets the new one, ends the other sessions and hands this device a fresh one", async () => {
    const admin = server();
    const anon = caller({ session: { access_token: "check" } }, { session: supabaseSession });
    const fresh = await changePassword(anon.client, admin.client, session, payload);

    expect(anon.signInWithPassword).toHaveBeenNthCalledWith(1, { email: "asha@example.com", password: "old pass" });
    expect(admin.updateUserById).toHaveBeenCalledWith("user-1", { password: "new pass" });
    expect(admin.signOut).toHaveBeenCalledWith("fresh", "others");
    expect(fresh.accessToken).toBe("fresh");
  });

  it("refuses a wrong current password, changing nothing", async () => {
    const admin = server();
    await expect(
      changePassword(caller({ error: authError("invalid_credentials") }).client, admin.client, session, payload),
    ).rejects.toMatchObject({ code: "AUTH_PASSWORD_INCORRECT", httpStatus: 400 });
    expect(admin.updateUserById).not.toHaveBeenCalled();
  });

  it("fails when Supabase will not set the new one", async () => {
    const anon = caller({ session: { access_token: "check" } });
    await expect(
      changePassword(anon.client, server({ update: authError("same_password") }).client, session, payload),
    ).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });

  it("keeps the new password when the other sessions would not end, logging it", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const anon = caller({ session: { access_token: "check" } }, { session: supabaseSession });
    await expect(
      changePassword(anon.client, server({ signOut: authError("session_not_found") }).client, session, payload),
    ).resolves.toMatchObject({ accessToken: "fresh" });
    expect(warn).toHaveBeenCalledWith("Could not end the other sessions after a password change", {
      code: "session_not_found",
    });
  });
});
