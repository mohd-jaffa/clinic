import type { SupabaseClient } from "@supabase/supabase-js";

import { captureError } from "@/lib/audit/errorLog";
import { externalServiceError, validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ChangePasswordPayload, EmailRequestPayload, PasswordResetCompletePayload } from "@/lib/validation";

import { findRecipient, sendPasswordResetEmail, sentTooRecently } from "./emails";
import { buildSession, loadSessionContext, sessionFromLink } from "./session";
import type { AuthenticatedSession } from "./types";

/**
 * Ends every other session the account has open, best effort: a password just
 * changed must not leave an old one working on another device. The password is
 * already changed, so a failure here is logged, not raised.
 */
async function endOtherSessions(admin: SupabaseClient, accessToken: string): Promise<void> {
  const { error } = await admin.auth.admin.signOut(accessToken, "others");
  if (error) logger.warn("Could not end the other sessions after a password change", { code: error.code });
}

/**
 * Forgot password (plan §5.3): a recovery link, sent through the app's own
 * mail. The answer is the same whether or not the address has an account,
 * and whether or not the email could go — it is logged — so this endpoint
 * cannot be used to find out who has one.
 */
export async function requestPasswordReset(
  admin: SupabaseClient,
  { email }: EmailRequestPayload,
): Promise<{ accepted: true }> {
  const recipient = await findRecipient(admin, email);
  if (!recipient || sentTooRecently(recipient)) return { accepted: true };

  try {
    await sendPasswordResetEmail(admin, recipient);
  } catch (failure) {
    await captureError({ message: "Could not send the password reset email", error: failure, userId: recipient.id });
  }
  return { accepted: true };
}

/**
 * Signs the person in afresh with the password just set. Setting a password
 * ends the account's sessions at Supabase, the one asking included, so the
 * device that changed it is handed a new one rather than signed out; then
 * every other session is ended.
 */
export async function freshSession(anon: SupabaseClient, admin: SupabaseClient, email: string, password: string) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw externalServiceError("EXTERNAL_SERVICE_ERROR", undefined, error);
  await endOtherSessions(admin, data.session.access_token);
  return buildSession(data.session, await loadSessionContext(admin, data.session.user.id));
}

/**
 * The reset screen's new password (plan §5.3): the link's session proves who
 * it is for — and that they hold the address, so it counts as confirmed. The
 * password is set, every other session ended, and the person signed in.
 */
export async function completePasswordReset(
  anon: SupabaseClient,
  admin: SupabaseClient,
  payload: PasswordResetCompletePayload,
): Promise<AuthenticatedSession> {
  const { user } = await sessionFromLink(anon, payload);
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: payload.password, email_confirm: true });
  if (error) throw externalServiceError("EXTERNAL_SERVICE_ERROR", undefined, error);
  return freshSession(anon, admin, user.email ?? "", payload.password);
}

/**
 * My account's Change password (plan §5.4): the current password is checked
 * first — a session left open on a front-desk computer must not be enough to
 * take the account — then the new one set, every other session ended, and
 * this device handed a fresh session. Allowed in a read-only clinic (plan §7.2).
 */
export async function changePassword(
  anon: SupabaseClient,
  admin: SupabaseClient,
  session: AuthenticatedSession,
  payload: ChangePasswordPayload,
): Promise<AuthenticatedSession> {
  const { data, error } = await anon.auth.signInWithPassword({
    email: session.profile.email,
    password: payload.currentPassword,
  });
  if (error || !data.session) throw validationError("AUTH_PASSWORD_INCORRECT");

  const { error: failed } = await admin.auth.admin.updateUserById(session.profile.id, {
    password: payload.newPassword,
  });
  if (failed) throw externalServiceError("EXTERNAL_SERVICE_ERROR", undefined, failed);
  return freshSession(anon, admin, session.profile.email, payload.newPassword);
}
