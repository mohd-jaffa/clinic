import type { SupabaseClient } from "@supabase/supabase-js";

import type { InviteRole } from "@/constants/roles";
import { tenantOf } from "@/features/auth/guard";
import { freshSession } from "@/features/auth/password";
import type { AuthenticatedSession } from "@/features/auth/types";
import { logActionSafe } from "@/lib/audit/auditLog";
import {
  businessRuleError,
  conflictError,
  externalServiceError,
  fromPostgrestError,
  validationError,
} from "@/lib/errors";
import type { AcceptInvitePayload } from "@/lib/validation";

import { hashInviteToken } from "./invites";

/**
 * Accepting an invite (plan §8.5, D63, D91, D92), before anyone has signed
 * in: the link's token, found by its hash, says which invite — never which
 * account a request names. Everyone sets a password, an existing account
 * too: the link proves the email, as a reset link does.
 */
interface FoundInvite {
  member_id: string;
  user_id: string;
  clinic_name: string;
  role: InviteRole;
  full_name: string;
  email: string;
  expired: boolean;
}

/** What the accept screen shows first (plan §8.5): the clinic, the role, the person. */
export interface InvitePreview {
  clinicName: string;
  role: InviteRole;
  fullName: string;
  email: string;
}

/** The open invite a token names, or why there is none to accept. */
async function openInvite(admin: SupabaseClient, token: string): Promise<FoundInvite> {
  const { data, error } = await admin.rpc("find_invite", { p_token_hash: hashInviteToken(token) });
  if (error) throw fromPostgrestError(error);
  const [invite] = (data ?? []) as FoundInvite[];
  if (!invite) throw validationError("INVITE_INVALID");
  if (invite.expired) throw businessRuleError("INVITE_EXPIRED");
  return invite;
}

export async function previewInvite(admin: SupabaseClient, { token }: { token: string }): Promise<InvitePreview> {
  const invite = await openInvite(admin, token);
  return { clinicName: invite.clinic_name, role: invite.role, fullName: invite.full_name, email: invite.email };
}

/**
 * Joins the clinic (plan §8.5). In order: the invite the token names, still
 * open and current; the mobile, no other account's; the account's password
 * and mobile, its email confirmed (the link proved it); `accept_invite` — the
 * name and mobile on the profile, the membership active, the token spent; the
 * audit row; and a fresh session, every other one of the account's ended. The
 * answer signs this device in, whoever was signed in on it before (D92).
 */
export async function acceptInvite(
  anon: SupabaseClient,
  admin: SupabaseClient,
  payload: AcceptInvitePayload,
  requestId?: string,
): Promise<AuthenticatedSession> {
  const invite = await openInvite(admin, payload.token);

  // A mobile is one account's (plan §5.1): asked first, since Auth's own refusal says only that it failed.
  const { data: holder, error: unread } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", payload.phone)
    .neq("id", invite.user_id)
    .maybeSingle();
  if (unread) throw fromPostgrestError(unread);
  if (holder) throw conflictError("AUTH_PHONE_ALREADY_EXISTS");

  const { error: refused } = await admin.auth.admin.updateUserById(invite.user_id, {
    password: payload.password,
    phone: payload.phone,
    phone_confirm: true,
    email_confirm: true,
  });
  if (refused) throw externalServiceError("EXTERNAL_SERVICE_ERROR", undefined, refused);

  const { error } = await admin.rpc("accept_invite", {
    p_token_hash: hashInviteToken(payload.token),
    p_full_name: payload.fullName,
    p_phone: payload.phone,
  });
  if (error) throw error.code === "23505" ? conflictError("AUTH_PHONE_ALREADY_EXISTS") : fromPostgrestError(error);

  const session = await freshSession(anon, admin, invite.email, payload.password);
  await logActionSafe(tenantOf(session, session.membership!), {
    action: "STATUS_CHANGE",
    entityType: "clinic_members",
    entityId: invite.member_id,
    changes: { status: { from: "INVITED", to: "ACTIVE" } },
    requestId,
  });
  return session;
}
