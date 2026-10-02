import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { effectivePermissions, type Permission } from "@/constants/permissions";
import type { ClinicRole, PlatformRole } from "@/constants/roles";
import type { SubscriptionPlan } from "@/constants/statuses";
import { readOnlyFrom, subscriptionState } from "@/features/subscription/state";
import { todayKey } from "@/lib/dates/calendar";
import { authenticationError, authorizationError, fromPostgrestError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getPlatformSettings } from "@/lib/platform/settings";
import type { LoginPayload } from "@/lib/validation";

import type { AuthenticatedSession, AuthSessionView, SessionContext, SessionMembership } from "./types";

interface MembershipRow {
  id: string;
  clinic_id: string;
  role: ClinicRole;
  permissions: Permission[];
  job_title: string | null;
  clinics: { name: string } | null;
  // One doctor profile per membership; PostgREST may hand it back as a list.
  doctors: { id: string; active: boolean } | { id: string; active: boolean }[] | null;
}

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  platform_role: PlatformRole | null;
  clinic_members: MembershipRow[];
}

/**
 * The profile, with its active membership (one per person, D23), its clinic
 * and its doctor profile. A membership names a profile three ways — its
 * person, who invited them, who deactivated them — so the person's own is
 * named by its foreign key.
 */
const SESSION_COLUMNS =
  "id, full_name, email, phone, platform_role, clinic_members!clinic_members_user_id_fkey(id, clinic_id, role, permissions, job_title, clinics(name), doctors(id, active))";

function toMembership(row: MembershipRow): SessionMembership {
  const doctor = Array.isArray(row.doctors) ? (row.doctors[0] ?? null) : row.doctors;
  return {
    id: row.id,
    clinicId: row.clinic_id,
    clinicName: row.clinics?.name ?? "",
    role: row.role,
    permissions: [...effectivePermissions(row.role, row.permissions)],
    doctorId: doctor?.active ? doctor.id : null,
    jobTitle: row.job_title,
  };
}

/** The clinic's plan, and where it stands today with the live settings (plan §7.2). */
async function loadSubscription(admin: SupabaseClient, clinicId: string) {
  const [{ data, error }, settings] = await Promise.all([
    admin.from("clinic_subscriptions").select("plan, valid_until").eq("clinic_id", clinicId).single(),
    getPlatformSettings(admin),
  ]);
  if (error) throw fromPostgrestError(error);

  const { plan, valid_until: validUntil } = data as { plan: SubscriptionPlan; valid_until: string };
  const state = subscriptionState({
    validUntil,
    today: todayKey(),
    warningDays: settings.expiryWarningDays,
    graceDays: settings.graceDays,
  });
  return { plan, validUntil, state, readOnlyFrom: readOnlyFrom(validUntil, settings.graceDays) };
}

/**
 * Everything a session knows about a person (plan §5.5): their profile, their
 * active membership and its permissions, and their clinic's plan. Read as the
 * server, since it decides what the person's own client may then do.
 *
 * - No profile: not one of ours — the session is refused.
 * - The platform admin: no membership and no plan; the console is theirs.
 * - Anyone else with no active membership — deactivated, or invited and not
 *   yet joined — cannot sign in to the clinic (plan §5.2).
 */
export async function loadSessionContext(admin: SupabaseClient, userId: string): Promise<SessionContext> {
  const { data, error } = await admin
    .from("profiles")
    .select(SESSION_COLUMNS)
    .eq("id", userId)
    .eq("clinic_members.status", "ACTIVE")
    .maybeSingle();
  if (error) throw fromPostgrestError(error);
  if (!data) throw authenticationError("AUTH_SESSION_INVALID");

  const row = data as unknown as ProfileRow;
  const profile = {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    platformRole: row.platform_role,
  };
  if (profile.platformRole === "DEV") return { profile, membership: null, subscription: null };

  const [active] = row.clinic_members;
  if (!active) throw authorizationError("AUTH_MEMBERSHIP_INACTIVE");

  const membership = toMembership(active);
  return { profile, membership, subscription: await loadSubscription(admin, membership.clinicId) };
}

/** A Supabase session and what it knows of the person, as the server holds it. */
export function buildSession(session: Session, context: SessionContext): AuthenticatedSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    ...context,
  };
}

/** What the browser is allowed to see of a session: everything except the tokens. */
export function toSessionView(session: AuthenticatedSession): AuthSessionView {
  return { profile: session.profile, membership: session.membership, subscription: session.subscription };
}

/**
 * Ends one session at Supabase, best effort: used when a password was right
 * but the person may not sign in after all, so the session it opened does not
 * linger. A failure is logged; the person is refused either way.
 */
export async function endSession(admin: SupabaseClient, accessToken: string): Promise<void> {
  const { error } = await admin.auth.admin.signOut(accessToken, "local");
  if (error) logger.warn("Could not end a session that was refused", { code: error.code });
}

/**
 * Signs in with an email or a mobile number and the password (plan §5.2, D39).
 * A wrong identifier and a wrong password answer the same, so the endpoint
 * cannot be used to find out who has an account. Only then is the rest
 * checked: the email must be confirmed before first use (Q17), and the person
 * must have an active membership (or be the platform admin).
 */
export async function login(
  anon: SupabaseClient,
  admin: SupabaseClient,
  credentials: LoginPayload,
): Promise<AuthenticatedSession> {
  const { data, error } = await anon.auth.signInWithPassword(credentials);

  if (error?.code === "email_not_confirmed") throw authorizationError("AUTH_EMAIL_NOT_CONFIRMED");
  if (error || !data.session || !data.user) throw authenticationError("AUTH_INVALID_CREDENTIALS");

  try {
    if (!data.user.email_confirmed_at) throw authorizationError("AUTH_EMAIL_NOT_CONFIRMED");
    return buildSession(data.session, await loadSessionContext(admin, data.user.id));
  } catch (refusal) {
    await endSession(admin, data.session.access_token);
    throw refusal;
  }
}

/**
 * Ends the session the caller is holding (plan §5.4's Sign out). It is revoked
 * at Supabase, so its refresh token can never be used again even if it was
 * copied before the cookies were cleared; a token already expired is not an
 * error — the caller wanted to be signed out, and they are.
 */
export async function logout(admin: SupabaseClient, accessToken: string) {
  const { error } = await admin.auth.admin.signOut(accessToken, "local");
  if (error) logger.warn("Sign out could not revoke the session", { code: error.code });
  return { signedOut: true };
}

/** The session behind an access token, as every guarded request reads it. */
export async function getSession(admin: SupabaseClient, accessToken: string): Promise<AuthenticatedSession> {
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) throw authenticationError("AUTH_SESSION_INVALID");

  return { accessToken, refreshToken: "", expiresAt: null, ...(await loadSessionContext(admin, data.user.id)) };
}

/**
 * Trades a refresh token for a fresh access token (plan §5.5), so a person
 * keeps working instead of being sent back to sign in every hour. The session
 * is read again with it: a member deactivated since is refused here.
 */
export async function refreshSession(
  anon: SupabaseClient,
  admin: SupabaseClient,
  refreshToken: string,
): Promise<AuthenticatedSession> {
  const { data, error } = await anon.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) throw authenticationError("AUTH_SESSION_INVALID");

  return buildSession(data.session, await loadSessionContext(admin, data.user.id));
}

/**
 * The session a link in an email opens — confirming an email, resetting a
 * password: Supabase has already checked the link by the time these tokens
 * exist. A link that has expired, or was used before, gives tokens it no
 * longer accepts.
 */
export async function sessionFromLink(
  anon: SupabaseClient,
  tokens: { accessToken: string; refreshToken: string },
): Promise<Session> {
  const { data, error } = await anon.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  if (error || !data.session || !data.user) throw authenticationError("AUTH_LINK_INVALID");
  return data.session;
}

/**
 * Completes the link in the confirmation email (plan §5.1): the address is
 * confirmed by Supabase as the link is opened; this hands back a signed-in
 * session, so confirming lands the owner in the app rather than at sign-in.
 */
export async function confirmEmail(
  anon: SupabaseClient,
  admin: SupabaseClient,
  tokens: { accessToken: string; refreshToken: string },
): Promise<AuthenticatedSession> {
  const session = await sessionFromLink(anon, tokens);
  if (!session.user.email_confirmed_at) throw authenticationError("AUTH_LINK_INVALID");
  return buildSession(session, await loadSessionContext(admin, session.user.id));
}
