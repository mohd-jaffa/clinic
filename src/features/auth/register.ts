import type { AuthError, SupabaseClient } from "@supabase/supabase-js";

import { captureError } from "@/lib/audit/errorLog";
import { getServerEnv } from "@/lib/env/server";
import { conflictError, externalServiceError, fromPostgrestError } from "@/lib/errors";
import { asMailFailure } from "@/lib/mail/failure";
import type { EmailRequestPayload, RegisterPayload } from "@/lib/validation";

import { findRecipient, sendConfirmationEmail, sentTooRecently } from "./emails";
import { mobileHmac } from "./trial";

/** What signing up answers (plan §5.1): never a session — the email is confirmed first (Q17). */
export interface Registration {
  email: string;
  /** False when this mobile has had its free trial before (D42): the clinic starts view-only. */
  trial: boolean;
  /** False when the confirmation email could not go; the confirm screen offers Resend. */
  confirmationSent: boolean;
}

interface RegisteredClinic {
  clinic_id: string;
  trial: boolean;
}

/** Supabase Auth's refusal of a new account, as the person is told it. */
function accountRefusal(error: AuthError) {
  if (error.code === "email_exists") return conflictError("AUTH_EMAIL_ALREADY_EXISTS");
  if (error.code === "phone_exists") return conflictError("AUTH_PHONE_ALREADY_EXISTS");
  return externalServiceError("EXTERNAL_SERVICE_ERROR", undefined, error);
}

/** Undoes the auth user when the clinic could not be made, so the email and mobile are free to try again. */
async function removeUser(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    await captureError({ message: "Could not remove the auth user after a failed sign-up", error, userId });
  }
}

/**
 * Signs up an owner and their clinic (plan §5.1). In order:
 *
 * 1. the auth user, unconfirmed, with the mobile confirmed (it signs in, D39);
 * 2. `register_clinic` — the profile, clinic, membership, doctor profile,
 *    trial or none (D42), seeds, audit — in one transaction; if it fails, the
 *    auth user is deleted again and the refusal is the answer;
 * 3. the confirmation email. A failed send never undoes the account: it is
 *    logged, and the answer says so for the confirm screen to offer Resend.
 */
export async function register(admin: SupabaseClient, payload: RegisterPayload): Promise<Registration> {
  const env = getServerEnv();
  const { data, error } = await admin.auth.admin.createUser({
    email: payload.email,
    phone: payload.phone,
    password: payload.password,
    email_confirm: false,
    phone_confirm: true,
  });
  if (error || !data.user) throw error ? accountRefusal(error) : externalServiceError();
  const userId = data.user.id;

  let clinic: RegisteredClinic;
  try {
    const { data: created, error: failed } = await admin.rpc("register_clinic", {
      p_user_id: userId,
      p_full_name: payload.fullName,
      p_email: payload.email,
      p_phone: payload.phone,
      p_sees_patients: payload.seesPatients,
      p_clinic_name: payload.clinicName,
      p_clinic_type: payload.clinicType,
      p_city: payload.city,
      p_address: payload.address,
      p_clinic_phone: payload.clinicPhone,
      p_mobile_hmac: mobileHmac(payload.phone, env.TRIAL_CLAIM_SECRET),
    });
    if (failed) throw fromPostgrestError(failed);
    clinic = created as RegisteredClinic;
  } catch (failure) {
    await removeUser(admin, userId);
    throw failure;
  }

  let confirmationSent = true;
  try {
    await sendConfirmationEmail(admin, {
      id: userId,
      fullName: payload.fullName,
      email: payload.email,
      emailLinkSentAt: null,
    });
  } catch (failure) {
    confirmationSent = false;
    await captureError({
      message: "Could not send the confirmation email",
      error: failure,
      userId,
      clinicId: clinic.clinic_id,
    });
  }

  return { email: payload.email, trial: clinic.trial, confirmationSent };
}

/**
 * The confirm screen's Resend (plan §5.1), asked before anyone has signed in.
 * It answers the same for an address with no account, one already confirmed,
 * and one sent an email moments ago, so it tells nobody who has an account;
 * a mail failure is reported, since the person is waiting for it.
 */
export async function resendConfirmation(
  admin: SupabaseClient,
  { email }: EmailRequestPayload,
): Promise<{ accepted: true }> {
  const recipient = await findRecipient(admin, email);
  if (!recipient || sentTooRecently(recipient)) return { accepted: true };

  const { data } = await admin.auth.admin.getUserById(recipient.id);
  if (!data.user || data.user.email_confirmed_at) return { accepted: true };

  try {
    await sendConfirmationEmail(admin, recipient);
  } catch (failure) {
    await captureError({ message: "Could not resend the confirmation email", error: failure, userId: recipient.id });
    throw asMailFailure(failure);
  }
  return { accepted: true };
}
