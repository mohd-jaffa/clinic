import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServerEnv } from "@/lib/env/server";

const { createTransport, sendMail } = vi.hoisted(() => {
  const sendMail = vi.fn(async () => ({}));
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock("nodemailer", () => ({ default: { createTransport } }));

const { createConfiguredMailService, NodemailerProvider } = await import("@/lib/mail/nodemailer.provider");

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_APP_URL: "https://clinicdesk.test",
  NODE_ENV: "test",
  TRIAL_CLAIM_SECRET: "a-secret-of-at-least-thirty-two-characters",
  SMTP_HOST: "smtp.gmail.com",
  SMTP_FROM: "ClinicDesk <no-reply@clinicdesk.test>",
} satisfies ServerEnv;

beforeEach(() => {
  createTransport.mockClear();
  sendMail.mockClear();
});

describe("NodemailerProvider", () => {
  it("signs in to the server only when given both a user and a password", () => {
    new NodemailerProvider({ host: "h", port: 465, secure: true, user: "u", password: "p" });
    expect(createTransport).toHaveBeenLastCalledWith({
      host: "h",
      port: 465,
      secure: true,
      auth: { user: "u", pass: "p" },
    });
    new NodemailerProvider({ host: "h", port: 25, secure: false, user: "u" });
    expect(createTransport).toHaveBeenLastCalledWith({ host: "h", port: 25, secure: false, auth: undefined });
  });

  it("sends the message as given", async () => {
    const message = { from: "f", to: "t", subject: "s", text: "x", html: "<p>x</p>" };
    await new NodemailerProvider({ host: "h", port: 25, secure: false }).send(message);
    expect(sendMail).toHaveBeenCalledWith(message);
  });
});

describe("createConfiguredMailService", () => {
  it("sends through the configured server, on 587 without TLS unless told otherwise", async () => {
    const mail = createConfiguredMailService(env);
    expect(createTransport).toHaveBeenCalledWith({ host: "smtp.gmail.com", port: 587, secure: false, auth: undefined });
    await mail.sendPasswordReset({ to: "a@b.co", name: "A", resetUrl: "https://clinicdesk.test/r" });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: env.SMTP_FROM, to: "a@b.co" }));

    createConfiguredMailService({ ...env, SMTP_PORT: 465, SMTP_SECURE: true, SMTP_USER: "u", SMTP_PASSWORD: "p" });
    expect(createTransport).toHaveBeenLastCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "u", pass: "p" },
    });
  });

  it("says mail is not configured without a server or a sender", () => {
    expect(() => createConfiguredMailService({ ...env, SMTP_HOST: undefined })).toThrow(
      expect.objectContaining({ code: "MAIL_NOT_CONFIGURED" }),
    );
    expect(() => createConfiguredMailService({ ...env, SMTP_FROM: undefined })).toThrow(
      expect.objectContaining({ code: "MAIL_NOT_CONFIGURED" }),
    );
  });

  it("reads the environment when given none", () => {
    vi.stubEnv("SMTP_HOST", "");
    expect(() => createConfiguredMailService()).toThrow();
    vi.unstubAllEnvs();
  });
});
