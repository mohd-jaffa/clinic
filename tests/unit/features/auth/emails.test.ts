import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMAIL_LINK_COOLDOWN_SECONDS } from "@/constants/limits";
import { AUTH_ROUTES } from "@/constants/routes";
import { authError, fakeSupabase, postgrestError, type FakeAnswer } from "@tests/support/supabase";

const { mail } = vi.hoisted(() => ({
  mail: { sendAccountConfirmation: vi.fn(async () => undefined), sendPasswordReset: vi.fn(async () => undefined) },
}));
vi.mock("@/lib/mail/nodemailer.provider", () => ({ createConfiguredMailService: () => mail }));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://clinicdesk.test" }) }));

const { findRecipient, sendConfirmationEmail, sendPasswordResetEmail, sentTooRecently } =
  await import("@/features/auth/emails");

const recipient = { id: "user-1", fullName: "Asha", email: "asha@example.com", emailLinkSentAt: null };

function server(answer: FakeAnswer = { data: null }, link: { data?: unknown; error?: unknown } = {}) {
  const generateLink = vi.fn(async () => ({
    data: { properties: { action_link: "https://supabase.test/verify?token=t" } },
    error: null,
    ...link,
  }));
  return { ...fakeSupabase({ answer: () => answer, auth: { admin: { generateLink } } }), generateLink };
}

beforeEach(() => {
  mail.sendAccountConfirmation.mockClear();
  mail.sendPasswordReset.mockClear();
});

describe("findRecipient", () => {
  it("finds an account by its email", async () => {
    const admin = server({
      data: { id: "user-1", full_name: "Asha", email: "asha@example.com", email_link_sent_at: "2026-10-02T10:00:00Z" },
    });
    await expect(findRecipient(admin.client, "asha@example.com")).resolves.toEqual({
      ...recipient,
      emailLinkSentAt: "2026-10-02T10:00:00Z",
    });
    expect(admin.find("profiles", "eq", "email", "asha@example.com")).toBeDefined();
  });

  it("is null for an address with no account, and says a failure as the app's own", async () => {
    await expect(findRecipient(server().client, "x@y.co")).resolves.toBeNull();
    await expect(findRecipient(server({ error: postgrestError("XX000") }).client, "x@y.co")).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });
});

describe("sentTooRecently", () => {
  const now = Date.parse("2026-10-02T10:00:00Z");

  it("holds another email back inside the cooldown, and lets it go after", () => {
    const at = (seconds: number) => new Date(now - seconds * 1000).toISOString();
    expect(sentTooRecently({ ...recipient, emailLinkSentAt: at(EMAIL_LINK_COOLDOWN_SECONDS - 1) }, now)).toBe(true);
    expect(sentTooRecently({ ...recipient, emailLinkSentAt: at(EMAIL_LINK_COOLDOWN_SECONDS) }, now)).toBe(false);
    expect(sentTooRecently(recipient, now)).toBe(false);
  });

  it("counts from now when no time is given", () => {
    expect(sentTooRecently({ ...recipient, emailLinkSentAt: new Date().toISOString() })).toBe(true);
  });
});

describe("sendConfirmationEmail", () => {
  it("sends a link that confirms the address and lands on the confirm screen, and notes when it went", async () => {
    const admin = server();
    await sendConfirmationEmail(admin.client, recipient);

    expect(admin.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "asha@example.com",
      options: { redirectTo: `https://clinicdesk.test${AUTH_ROUTES.confirmEmail}` },
    });
    expect(mail.sendAccountConfirmation).toHaveBeenCalledWith({
      to: "asha@example.com",
      name: "Asha",
      confirmationUrl: "https://supabase.test/verify?token=t",
    });
    expect(admin.find("profiles", "eq", "id", "user-1")).toBeDefined();
  });

  it("fails when Supabase makes no link, sending nothing", async () => {
    const admin = server(undefined, { data: { properties: null }, error: authError("unexpected_failure") });
    await expect(sendConfirmationEmail(admin.client, recipient)).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
    });
    const empty = server(undefined, { data: {}, error: null });
    await expect(sendConfirmationEmail(empty.client, recipient)).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
    });
    expect(mail.sendAccountConfirmation).not.toHaveBeenCalled();
  });

  it("fails when it cannot note that the email went", async () => {
    const admin = server({ error: postgrestError("XX000") });
    await expect(sendConfirmationEmail(admin.client, recipient)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });
});

describe("sendPasswordResetEmail", () => {
  it("sends a recovery link that lands on the reset screen", async () => {
    const admin = server();
    await sendPasswordResetEmail(admin.client, recipient);

    expect(admin.generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "recovery",
        options: { redirectTo: `https://clinicdesk.test${AUTH_ROUTES.resetPassword}` },
      }),
    );
    expect(mail.sendPasswordReset).toHaveBeenCalledWith({
      to: "asha@example.com",
      name: "Asha",
      resetUrl: "https://supabase.test/verify?token=t",
    });
  });
});
