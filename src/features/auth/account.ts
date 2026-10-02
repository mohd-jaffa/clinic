import type { SupabaseClient } from "@supabase/supabase-js";

import { conflictError, externalServiceError, fromPostgrestError } from "@/lib/errors";
import type { UpdateProfilePayload } from "@/lib/validation";

import type { AuthenticatedSession, SessionProfile } from "./types";

/**
 * My account's name and mobile (plan §5.4). The mobile signs in (D39), so it
 * changes on the profile — whose unique index refuses one another account
 * holds — and then in Supabase Auth; if Auth cannot take it, the profile is
 * put back. Both are written as the server: a member never writes a profile
 * (0002).
 */
export async function updateProfile(
  admin: SupabaseClient,
  session: AuthenticatedSession,
  payload: UpdateProfilePayload,
): Promise<SessionProfile> {
  const { profile } = session;
  const changes: { full_name?: string; phone?: string } = {};
  if (payload.fullName !== undefined && payload.fullName !== profile.fullName) changes.full_name = payload.fullName;
  if (payload.phone !== undefined && payload.phone !== profile.phone) changes.phone = payload.phone;
  if (Object.keys(changes).length === 0) return profile;

  const { data, error } = await admin
    .from("profiles")
    .update(changes)
    .eq("id", profile.id)
    .select("full_name, phone")
    .single();
  if (error) throw error.code === "23505" ? conflictError("AUTH_PHONE_ALREADY_EXISTS") : fromPostgrestError(error);

  if (changes.phone) {
    const { error: failed } = await admin.auth.admin.updateUserById(profile.id, {
      phone: changes.phone,
      phone_confirm: true,
    });
    if (failed) {
      await admin.from("profiles").update({ phone: profile.phone }).eq("id", profile.id);
      throw failed.code === "phone_exists"
        ? conflictError("AUTH_PHONE_ALREADY_EXISTS")
        : externalServiceError("EXTERNAL_SERVICE_ERROR", undefined, failed);
    }
  }

  return { ...profile, fullName: data.full_name, phone: data.phone };
}
