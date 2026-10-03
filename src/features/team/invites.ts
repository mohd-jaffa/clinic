import { createHash, randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AUTH_ROUTES } from "@/constants/routes";
import { findRecipient, markSent, sentTooRecently, type Recipient } from "@/features/auth/emails";
import { logActionSafe } from "@/lib/audit/auditLog";
import { captureError } from "@/lib/audit/errorLog";
import { getServerEnv } from "@/lib/env/server";
import { businessRuleError, conflictError, externalServiceError, fromPostgrestError } from "@/lib/errors";
import { asMailFailure } from "@/lib/mail/failure";
import { createConfiguredMailService } from "@/lib/mail/nodemailer.provider";
import { getPlatformSettings } from "@/lib/platform/settings";
import type { Tenant } from "@/lib/supabase/tenant";
import type { InvitePayload } from "@/lib/validation";

import { findMember } from "./api";
import type { InviteOutcome, TeamMember } from "./types";

/**
 * Inviting the team (plan §8.4, D63, D90). The owner, or a member with
 * `team.manage`, invites someone by email; the account is made here, through
 * the admin API, with no password, and 0012's functions write the rest as the
 * server — checking again who is acting and what they may grant. Each invite
 * has a token of its own: random, sent only in the emailed link, and only its
 * hash kept. Resend gives it a new one; revoke removes the invite, and the
 * account with it when the invite made it and it was never used.
 */
interface MembershipRow {
  id: string;
  invite_expires_at: string;
}

/** The hash an invite's token is kept as (D63): the token itself is in the link alone. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A token for a new link: random, and long enough that it cannot be guessed. */
function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

/** Undoes an account made for an invite that could not be written, so the email is free again. */
async function removeAccount(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) await captureError({ message: "Could not remove an invited account", error, userId });
}

/**
 * The invite email (plan §22): who invited them, to which clinic, as what,
 * and the link — the only place its token goes. Throws when it could not go.
 */
async function sendInviteEmail(
  tenant: Tenant,
  admin: SupabaseClient,
  { recipient, role, token }: { recipient: Recipient; role: "DOCTOR" | "STAFF"; token: string },
): Promise<void> {
  const [clinic, inviter, settings] = await Promise.all([
    admin.from("clinics").select("name").eq("id", tenant.clinicId).single<{ name: string }>(),
    admin.from("profiles").select("full_name").eq("id", tenant.actorId).single<{ full_name: string }>(),
    getPlatformSettings(admin),
  ]);
  for (const { error } of [clinic, inviter]) if (error) throw fromPostgrestError(error);
  await createConfiguredMailService().sendInvite({
    to: recipient.email,
    name: recipient.fullName,
    inviterName: inviter.data!.full_name,
    clinicName: clinic.data!.name,
    role,
    // In the fragment: an address's fragment is never sent to a server, so never in a log.
    inviteUrl: `${getServerEnv().NEXT_PUBLIC_APP_URL}${AUTH_ROUTES.acceptInvite}#token=${token}`,
    validDays: settings.inviteValidDays,
  });
  await markSent(admin, recipient);
}

/**
 * Invites someone (plan §8.4). In order: their account — theirs already, or
 * made now with no password; `invite_member`, which writes the profile, the
 * membership and a doctor's profile in one transaction (if it refuses, an
 * account made for it is removed again); the audit row; and the email. A
 * failed email never undoes the invite: it is logged, and the answer says so
 * for the screen to offer Resend.
 */
export async function inviteMember(
  tenant: Tenant,
  admin: SupabaseClient,
  invite: InvitePayload,
  requestId?: string,
): Promise<InviteOutcome> {
  const existing = await findRecipient(admin, invite.email);
  let userId = existing?.id;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({ email: invite.email, email_confirm: false });
    if (error || !data.user) throw externalServiceError("EXTERNAL_SERVICE_ERROR", undefined, error);
    userId = data.user.id;
  }

  const { token, hash } = newToken();
  const { data, error } = await admin.rpc("invite_member", {
    p_clinic_id: tenant.clinicId,
    p_actor_id: tenant.actorId,
    p_user_id: userId,
    p_full_name: invite.fullName,
    p_email: invite.email,
    p_role: invite.role,
    p_job_title: invite.jobTitle,
    p_permissions: invite.permissions,
    p_doctor: invite.doctor && {
      specialization: invite.doctor.specialization,
      qualifications: invite.doctor.qualifications,
      registration_number: invite.doctor.registrationNumber,
      consultation_fee_paise: invite.doctor.fee,
    },
    p_token_hash: hash,
  });
  if (error) {
    if (!existing) await removeAccount(admin, userId);
    throw error.code === "23505" ? conflictError("MEMBER_ALREADY_EXISTS") : fromPostgrestError(error);
  }
  const membership = data as MembershipRow;

  await logActionSafe(tenant, {
    action: "CREATE",
    entityType: "clinic_members",
    entityId: membership.id,
    changes: {
      email: { from: null, to: invite.email },
      role: { from: null, to: invite.role },
      status: { from: null, to: "INVITED" },
      job_title: { from: null, to: invite.jobTitle },
      permissions: { from: null, to: invite.permissions },
    },
    requestId,
  });

  const recipient: Recipient = {
    id: userId,
    fullName: existing?.fullName ?? invite.fullName,
    email: invite.email,
    emailLinkSentAt: null,
  };
  let emailSent = true;
  try {
    await sendInviteEmail(tenant, admin, { recipient, role: invite.role, token });
  } catch (failure) {
    emailSent = false;
    await captureError({
      message: "Could not send an invite email",
      error: failure,
      userId,
      clinicId: tenant.clinicId,
      reference: requestId,
    });
  }

  return {
    member: {
      id: membership.id,
      userId,
      name: recipient.fullName,
      email: invite.email,
      role: invite.role,
      status: "INVITED",
      jobTitle: invite.jobTitle,
      permissions: invite.permissions,
      inviteExpiresAt: membership.invite_expires_at,
      inviteExpired: false,
      specialization: invite.doctor?.specialization ?? null,
      isDoctor: invite.doctor !== null,
    },
    emailSent,
  };
}

/** An open invite of the caller's clinic, or why there is none to act on. */
async function openInvite(tenant: Tenant, id: string): Promise<TeamMember> {
  const member = await findMember(tenant, id);
  if (member.status !== "INVITED") throw conflictError("INVITE_CHANGED");
  return member;
}

/**
 * Sends an invite again with a new link (plan §8.4): the old one stops
 * working, and the new one lasts `invite_valid_days` from now. Not twice
 * within the cooldown. The person is waiting for it, so a failed email is
 * the answer.
 */
export async function resendInvite(
  tenant: Tenant,
  admin: SupabaseClient,
  id: string,
  requestId?: string,
): Promise<TeamMember> {
  const member = await openInvite(tenant, id);
  const recipient = (await findRecipient(admin, member.email))!;
  if (sentTooRecently(recipient)) throw businessRuleError("INVITE_SENT_RECENTLY");

  const { token, hash } = newToken();
  const { data, error } = await admin.rpc("resend_invite", {
    p_clinic_id: tenant.clinicId,
    p_actor_id: tenant.actorId,
    p_member_id: id,
    p_token_hash: hash,
  });
  if (error) throw fromPostgrestError(error);
  const renewed = { ...member, inviteExpiresAt: (data as MembershipRow).invite_expires_at, inviteExpired: false };

  await logActionSafe(tenant, {
    action: "UPDATE",
    entityType: "clinic_members",
    entityId: id,
    changes: { invite_expires_at: { from: member.inviteExpiresAt, to: renewed.inviteExpiresAt } },
    requestId,
  });

  try {
    await sendInviteEmail(tenant, admin, { recipient, role: member.role as "DOCTOR" | "STAFF", token });
  } catch (failure) {
    await captureError({
      message: "Could not resend an invite email",
      error: failure,
      userId: member.userId,
      clinicId: tenant.clinicId,
      reference: requestId,
    });
    throw asMailFailure(failure);
  }
  return renewed;
}

/**
 * The account an invite made goes with it when it was never used: no other
 * membership, and an email never confirmed. Anyone's own account stays.
 */
async function removeUnusedAccount(admin: SupabaseClient, userId: string): Promise<void> {
  const { count } = await admin
    .from("clinic_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (count !== 0) return;
  const { data } = await admin.auth.admin.getUserById(userId);
  if (!data.user || data.user.email_confirmed_at) return;
  await removeAccount(admin, userId);
}

/** Revokes an open invite (plan §8.4): its link stops working, and it can be sent again later. */
export async function revokeInvite(
  tenant: Tenant,
  admin: SupabaseClient,
  id: string,
  requestId?: string,
): Promise<TeamMember> {
  const member = await openInvite(tenant, id);
  const { error } = await admin.rpc("revoke_invite", {
    p_clinic_id: tenant.clinicId,
    p_actor_id: tenant.actorId,
    p_member_id: id,
  });
  if (error) throw fromPostgrestError(error);

  await logActionSafe(tenant, {
    action: "DELETE",
    entityType: "clinic_members",
    entityId: id,
    changes: {
      email: { from: member.email, to: null },
      role: { from: member.role, to: null },
      status: { from: "INVITED", to: null },
    },
    requestId,
  });
  await removeUnusedAccount(admin, member.userId);
  return member;
}
