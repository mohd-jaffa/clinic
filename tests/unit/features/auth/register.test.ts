import { beforeEach, describe, expect, it, vi } from "vitest";

import { mobileHmac } from "@/features/auth/trial";
import { externalServiceError } from "@/lib/errors";
import type { RegisterPayload } from "@/lib/validation";
import { authError, fakeSupabase, postgrestError } from "@tests/support/supabase";

const SECRET = "a-secret-of-at-least-thirty-two-characters";

const { emails, captureError } = vi.hoisted(() => ({
  emails: { findRecipient: vi.fn(), sentTooRecently: vi.fn(() => false), sendConfirmationEmail: vi.fn() },
  captureError: vi.fn(async () => undefined),
}));
vi.mock("@/features/auth/emails", () => emails);
vi.mock("@/lib/audit/errorLog", () => ({ captureError }));
vi.mock("@/lib/env/server", () => ({ getServerEnv: () => ({ TRIAL_CLAIM_SECRET: SECRET }) }));

const { register, resendConfirmation } = await import("@/features/auth/register");

const payload: RegisterPayload = {
  fullName: "Asha Menon",
  email: "asha@example.com",
  phone: "+919876543210",
  password: "a secret ",
  seesPatients: true,
  clinicName: "Smile Care",
  clinicType: "DENTAL",
  city: "Kochi",
  address: "12 MG Road",
  clinicPhone: null,
};

function server({
  created = { data: { user: { id: "user-1" } }, error: null } as { data: unknown; error: unknown },
  clinic = { data: { clinic_id: "clinic-1", trial: true } } as { data?: unknown; error?: unknown },
  deleted = null as unknown,
  user = { id: "user-1", email_confirmed_at: null } as unknown,
} = {}) {
  const admin = {
    createUser: vi.fn(async () => created),
    deleteUser: vi.fn(async () => ({ error: deleted })),
    getUserById: vi.fn(async () => ({ data: { user } })),
  };
  return { ...fakeSupabase({ rpc: () => clinic, auth: { admin } }), admin };
}

beforeEach(() => {
  emails.findRecipient.mockReset();
  emails.sentTooRecently.mockReset();
  emails.sentTooRecently.mockReturnValue(false);
  emails.sendConfirmationEmail.mockReset();
  captureError.mockClear();
});

describe("register", () => {
  it("makes the auth user unconfirmed with the mobile confirmed, then the clinic, then sends the confirmation", async () => {
    const supabase = server();
    await expect(register(supabase.client, payload)).resolves.toEqual({
      email: "asha@example.com",
      trial: true,
      confirmationSent: true,
    });

    expect(supabase.admin.createUser).toHaveBeenCalledWith({
      email: "asha@example.com",
      phone: "+919876543210",
      password: "a secret ",
      email_confirm: false,
      phone_confirm: true,
    });
    expect(supabase.rpcs).toEqual([
      {
        name: "register_clinic",
        args: {
          p_user_id: "user-1",
          p_full_name: "Asha Menon",
          p_email: "asha@example.com",
          p_phone: "+919876543210",
          p_sees_patients: true,
          p_clinic_name: "Smile Care",
          p_clinic_type: "DENTAL",
          p_city: "Kochi",
          p_address: "12 MG Road",
          p_clinic_phone: null,
          // The mobile itself never reaches the trial claim (D42).
          p_mobile_hmac: mobileHmac("+919876543210", SECRET),
        },
      },
    ]);
    expect(emails.sendConfirmationEmail).toHaveBeenCalledWith(supabase.client, {
      id: "user-1",
      fullName: "Asha Menon",
      email: "asha@example.com",
      emailLinkSentAt: null,
    });
  });

  it("refuses an email or a mobile another account holds", async () => {
    const email = server({ created: { data: { user: null }, error: authError("email_exists") } });
    await expect(register(email.client, payload)).rejects.toMatchObject({
      code: "AUTH_EMAIL_ALREADY_EXISTS",
      httpStatus: 409,
    });
    const phone = server({ created: { data: { user: null }, error: authError("phone_exists") } });
    await expect(register(phone.client, payload)).rejects.toMatchObject({ code: "AUTH_PHONE_ALREADY_EXISTS" });
  });

  it("says any other Supabase Auth failure as the outside service's", async () => {
    const down = server({ created: { data: { user: null }, error: authError("unexpected_failure") } });
    await expect(register(down.client, payload)).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
    const empty = server({ created: { data: { user: null }, error: null } });
    await expect(register(empty.client, payload)).rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });

  it("deletes the auth user again when the clinic could not be made, and answers the refusal", async () => {
    const supabase = server({ clinic: { error: postgrestError("23505") } });
    await expect(register(supabase.client, payload)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(supabase.admin.deleteUser).toHaveBeenCalledWith("user-1");
    expect(emails.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("logs an auth user it could not delete", async () => {
    const supabase = server({ clinic: { error: postgrestError("XX000") }, deleted: authError("unexpected_failure") });
    await expect(register(supabase.client, payload)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Could not remove the auth user after a failed sign-up", userId: "user-1" }),
    );
  });

  it("keeps the account when the confirmation could not go, saying so for Resend", async () => {
    emails.sendConfirmationEmail.mockRejectedValue(externalServiceError("MAIL_NOT_CONFIGURED"));
    const supabase = server({ clinic: { data: { clinic_id: "clinic-1", trial: false } } });
    await expect(register(supabase.client, payload)).resolves.toEqual({
      email: "asha@example.com",
      trial: false,
      confirmationSent: false,
    });
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Could not send the confirmation email", clinicId: "clinic-1" }),
    );
    expect(supabase.admin.deleteUser).not.toHaveBeenCalled();
  });
});

describe("resendConfirmation", () => {
  const recipient = { id: "user-1", fullName: "Asha", email: "asha@example.com", emailLinkSentAt: null };

  it("sends the confirmation again to an account not yet confirmed", async () => {
    emails.findRecipient.mockResolvedValue(recipient);
    const supabase = server();
    await expect(resendConfirmation(supabase.client, { email: "asha@example.com" })).resolves.toEqual({
      accepted: true,
    });
    expect(emails.sendConfirmationEmail).toHaveBeenCalledWith(supabase.client, recipient);
  });

  it("answers the same, sending nothing, for no account, one sent moments ago, or one confirmed", async () => {
    emails.findRecipient.mockResolvedValue(null);
    await expect(resendConfirmation(server().client, { email: "x@y.co" })).resolves.toEqual({ accepted: true });

    emails.findRecipient.mockResolvedValue(recipient);
    emails.sentTooRecently.mockReturnValue(true);
    await expect(resendConfirmation(server().client, { email: "asha@example.com" })).resolves.toEqual({
      accepted: true,
    });

    emails.sentTooRecently.mockReturnValue(false);
    const confirmed = server({ user: { id: "user-1", email_confirmed_at: "2026-10-01T00:00:00Z" } });
    await expect(resendConfirmation(confirmed.client, { email: "asha@example.com" })).resolves.toEqual({
      accepted: true,
    });
    const gone = server({ user: null });
    await expect(resendConfirmation(gone.client, { email: "asha@example.com" })).resolves.toEqual({ accepted: true });

    expect(emails.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  it("tells the person waiting when the email could not go, in the outside service's words", async () => {
    emails.findRecipient.mockResolvedValue(recipient);
    emails.sendConfirmationEmail.mockRejectedValue(new Error("535 not accepted"));
    await expect(resendConfirmation(server().client, { email: "asha@example.com" })).rejects.toMatchObject({
      code: "EXTERNAL_SERVICE_ERROR",
      httpStatus: 502,
    });
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Could not resend the confirmation email" }),
    );
  });
});
