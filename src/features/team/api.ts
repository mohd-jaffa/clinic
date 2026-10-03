import { fromPostgrestError, notFoundError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";

import type { Doctor, DoctorRow, TeamMember, TeamMemberRow } from "./types";

/**
 * The clinic's doctors who can be picked (plan §30, `GET /api/doctors`): a
 * doctor profile still active, of a member still active, by name. Every
 * member reads them — booking, closures and the calendar choose from them.
 */
export async function listDoctors(tenant: Tenant): Promise<Doctor[]> {
  const { data, error } = await tenant.supabase
    .from("doctors")
    .select("id, member:clinic_members!inner(profile:profiles!clinic_members_user_id_fkey!inner(full_name))")
    .eq("clinic_id", tenant.clinicId)
    .eq("active", true)
    .eq("member.status", "ACTIVE");
  if (error) throw fromPostgrestError(error);
  return ((data ?? []) as unknown as DoctorRow[])
    .map((row) => ({ id: row.id, name: row.member.profile.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A membership names a profile three ways — its person, who invited them,
 * who deactivated them — so the person's own is named by its foreign key.
 */
const MEMBER_COLUMNS =
  "id, user_id, role, status, job_title, permissions, invite_expires_at, profile:profiles!clinic_members_user_id_fkey(full_name, email), doctors(specialization)";

export function toTeamMember(row: TeamMemberRow): TeamMember {
  const doctor = Array.isArray(row.doctors) ? (row.doctors[0] ?? null) : row.doctors;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.profile.full_name,
    email: row.profile.email,
    role: row.role,
    status: row.status,
    jobTitle: row.job_title,
    permissions: row.permissions,
    inviteExpiresAt: row.invite_expires_at,
    inviteExpired: row.invite_expires_at !== null && Date.parse(row.invite_expires_at) < Date.now(),
    specialization: doctor?.specialization ?? null,
    isDoctor: doctor !== null,
  };
}

/** The team (plan §8.6): everyone of the clinic, invited and inactive too — the owner first, then by name. */
export async function listTeam(tenant: Tenant): Promise<TeamMember[]> {
  const { data, error } = await tenant.supabase
    .from("clinic_members")
    .select(MEMBER_COLUMNS)
    .eq("clinic_id", tenant.clinicId);
  if (error) throw fromPostgrestError(error);
  return ((data ?? []) as unknown as TeamMemberRow[])
    .map(toTeamMember)
    .sort((a, b) => Number(b.role === "OWNER") - Number(a.role === "OWNER") || a.name.localeCompare(b.name));
}

/** One member of the caller's own clinic, as the team list reads them. */
export async function findMember(tenant: Tenant, id: string): Promise<TeamMember> {
  const { data, error } = await tenant.supabase
    .from("clinic_members")
    .select(MEMBER_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw fromPostgrestError(error);
  if (!data) throw notFoundError("RECORD_NOT_FOUND");
  return toTeamMember(data as unknown as TeamMemberRow);
}
