import { logActionSafe } from "@/lib/audit/auditLog";
import { changedValues } from "@/lib/audit/changes";
import { fromPostgrestError, notFoundError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type { UpdateMemberPayload } from "@/lib/validation";

import { toTeamMember } from "./api";
import type { MemberDetail, MemberDetailRow } from "./types";

/**
 * A member's page (plan §8.6, D93 – D95): read, changed and deactivated by
 * the signed-in manager as themselves, through 0013's functions — which
 * check again that they may, as the database's last word. Each change is
 * audited with its values; none is clinical.
 */
const DETAIL_COLUMNS =
  "id, user_id, role, status, job_title, permissions, invite_expires_at, profile:profiles!clinic_members_user_id_fkey(full_name, email, phone), doctors(specialization, qualifications, registration_number, consultation_fee_paise)";

/** The values a change is audited by, as flat columns: permissions, job title, a doctor's four. */
const AUDITED = [
  "permissions",
  "job_title",
  "specialization",
  "qualifications",
  "registration_number",
  "consultation_fee_paise",
] as const;

function toMemberDetail(row: MemberDetailRow): MemberDetail {
  const doctor = Array.isArray(row.doctors) ? (row.doctors[0] ?? null) : row.doctors;
  return {
    ...toTeamMember({ ...row, doctors: doctor && { specialization: doctor.specialization } }),
    phone: row.profile.phone,
    doctor: doctor && {
      specialization: doctor.specialization,
      qualifications: doctor.qualifications,
      registrationNumber: doctor.registration_number,
      feePaise: doctor.consultation_fee_paise,
    },
  };
}

/** What a change is audited as: the member's values as flat columns. */
const audited = (member: MemberDetail) => ({
  permissions: member.permissions.join(","),
  job_title: member.jobTitle,
  specialization: member.doctor?.specialization ?? null,
  qualifications: member.doctor?.qualifications ?? null,
  registration_number: member.doctor?.registrationNumber ?? null,
  consultation_fee_paise: member.doctor?.feePaise ?? null,
});

/** One member of the caller's clinic, with their mobile and a doctor's details. */
export async function getMember(tenant: Tenant, id: string): Promise<MemberDetail> {
  const { data, error } = await tenant.supabase
    .from("clinic_members")
    .select(DETAIL_COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw fromPostgrestError(error);
  if (!data) throw notFoundError("RECORD_NOT_FOUND");
  return toMemberDetail(data as unknown as MemberDetailRow);
}

/** Changes what is named — their access, job title or doctor's details — and audits what changed. */
export async function updateMember(
  tenant: Tenant,
  id: string,
  changes: UpdateMemberPayload,
  requestId?: string,
): Promise<MemberDetail> {
  const before = await getMember(tenant, id);
  const { error } = await tenant.supabase.rpc("update_member", {
    p_member_id: id,
    p_changes: {
      ...(changes.permissions && { permissions: changes.permissions }),
      ...(changes.jobTitle !== undefined && { job_title: changes.jobTitle }),
      ...(changes.doctor && {
        doctor: {
          specialization: changes.doctor.specialization,
          qualifications: changes.doctor.qualifications,
          registration_number: changes.doctor.registrationNumber,
          consultation_fee_paise: changes.doctor.fee,
        },
      }),
    },
  });
  if (error) throw fromPostgrestError(error);

  const after = await getMember(tenant, id);
  const changed = changedValues(audited(before), audited(after), AUDITED);
  if (Object.keys(changed).length > 0) {
    await logActionSafe(tenant, {
      action: "UPDATE",
      entityType: "clinic_members",
      entityId: id,
      changes: changed,
      requestId,
    });
  }
  return after;
}

/** Deactivates or reactivates them (plan §8.6), audited as the status it moved to. */
export async function setMemberActive(
  tenant: Tenant,
  id: string,
  active: boolean,
  requestId?: string,
): Promise<MemberDetail> {
  const before = await getMember(tenant, id);
  const { error } = await tenant.supabase.rpc("set_member_active", { p_member_id: id, p_active: active });
  if (error) throw fromPostgrestError(error);

  const after = await getMember(tenant, id);
  if (after.status !== before.status) {
    await logActionSafe(tenant, {
      action: "STATUS_CHANGE",
      entityType: "clinic_members",
      entityId: id,
      changes: { status: { from: before.status, to: after.status } },
      requestId,
    });
  }
  return after;
}
