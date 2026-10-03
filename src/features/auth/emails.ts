import type { SupabaseClient } from "@supabase/supabase-js";

import { EMAIL_LINK_COOLDOWN_SECONDS } from "@/constants/limits";
import { AUTH_ROUTES } from "@/constants/routes";
import { getServerEnv } from "@/lib/env/server";
import { externalServiceError, fromPostgrestError } from "@/lib/errors";
import { createConfiguredMailService } from "@/lib/mail/nodemailer.provider";

/** Who an account email goes to, as `profiles` holds them. */
export interface Recipient {
  id: string;
  fullName: string;
  email: string;
  /** When the last confirmation or reset email went to them. */
  emailLinkSentAt: string | null;
}

/** An account, by its email, for a request made before anyone has signed in; null when there is none. */
export async function findRecipient(admin: SupabaseClient, email: string): Promise<Recipient | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email, email_link_sent_at")
    .eq("email", email)
    .maybeSingle();
  if (error) throw fromPostgrestError(error);
  if (!data) return null;
  return { id: data.id, fullName: data.full_name, email: data.email, emailLinkSentAt: data.email_link_sent_at };
}

/**
 * Whether one of these emails went to the account too recently to send
 * another (EMAIL_LINK_COOLDOWN_SECONDS): a button pressed over and over must
 * not fill someone's inbox.
 */
export function sentTooRecently(recipient: Recipient, nowMs: number = Date.now()): boolean {
  if (!recipient.emailLinkSentAt) return false;
  return nowMs - Date.parse(recipient.emailLinkSentAt) < EMAIL_LINK_COOLDOWN_SECONDS * 1000;
}

/** The link Supabase Auth makes for an account, landing on one of the app's screens. */
async function authLink(
  admin: SupabaseClient,
  type: "magiclink" | "recovery",
  email: string,
  landing: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({
    type,
    email,
    options: { redirectTo: `${getServerEnv().NEXT_PUBLIC_APP_URL}${landing}` },
  });
  if (error || !data.properties?.action_link) throw externalServiceError("EXTERNAL_SERVICE_ERROR", undefined, error);
  return data.properties.action_link;
}

/** Notes the moment an account email went to someone, for the next one's cooldown — the team's invites too. */
export async function markSent(admin: SupabaseClient, recipient: Recipient): Promise<void> {
  const { error } = await admin
    .from("profiles")
    .update({ email_link_sent_at: new Date().toISOString() })
    .eq("id", recipient.id);
  if (error) throw fromPostgrestError(error);
}

/**
 * The confirmation email (plan §5.1): a link that confirms the address as it
 * is opened, and lands on the confirm screen signed in. Throws when the email
 * could not go, for the caller to report or log.
 */
export async function sendConfirmationEmail(admin: SupabaseClient, recipient: Recipient): Promise<void> {
  const mail = createConfiguredMailService();
  const confirmationUrl = await authLink(admin, "magiclink", recipient.email, AUTH_ROUTES.confirmEmail);
  await mail.sendAccountConfirmation({ to: recipient.email, name: recipient.fullName, confirmationUrl });
  await markSent(admin, recipient);
}

/**
 * The password-reset email (plan §5.3, Q18): a recovery link that opens the
 * reset screen signed in, to choose a new password. Throws when the email
 * could not go.
 */
export async function sendPasswordResetEmail(admin: SupabaseClient, recipient: Recipient): Promise<void> {
  const mail = createConfiguredMailService();
  const resetUrl = await authLink(admin, "recovery", recipient.email, AUTH_ROUTES.resetPassword);
  await mail.sendPasswordReset({ to: recipient.email, name: recipient.fullName, resetUrl });
  await markSent(admin, recipient);
}
