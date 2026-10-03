import { fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";

import type { Doctor, DoctorRow } from "./types";

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
