import { logActionSafe } from "@/lib/audit/auditLog";
import { changedValues } from "@/lib/audit/changes";
import { fromPostgrestError, notFoundError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type { DoctorDetailsPayload, OwnDoctorPayload, UpdateMemberPayload } from "@/lib/validation";

import { toTeamMember } from "./api";
import type { MemberDetail, MemberDetailRow } from "./types";

/**
 * A member's page (plan §8.6, D93 – D95): read, changed and deactivated by
 * the signed-in manager as themselves, through 0013's functions — which
 * check again that they may, as the database's last word. Each change is
 * audited with its values; none is clinical.
 */
const DETAIL_COLUMNS =
  "id, user_id, role, status, job_title, permissions, invite_expires_at, profile:profiles!clinic_members_user_id_fkey(full_name, email, phone), doctors(active, specialization, qualifications, registration_number, consultation_fee_paise)";

/** The values a change is audited by, as flat columns: permissions, job title, a doctor's profile. */
const AUDITED = [
  "sees_patients",
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
    seesPatients: doctor?.active ?? false,
  };
}

/** What a change is audited as: the member's values as flat columns. */
const audited = (member: MemberDetail) => ({
  sees_patients: member.seesPatients,
  permissions: member.permissions.join(","),
  job_title: member.jobTitle,
  specialization: member.doctor?.specialization ?? null,
  qualifications: member.doctor?.qualifications ?? null,
  registration_number: member.doctor?.registrationNumber ?? null,
  consultation_fee_paise: member.doctor?.feePaise ?? null,
});

/** A doctor's details as 0013 and 0014 name them. */
const doctorColumns = (doctor: DoctorDetailsPayload) => ({
  specialization: doctor.specialization,
  qualifications: doctor.qualifications,
  registration_number: doctor.registrationNumber,
  consultation_fee_paise: doctor.fee,
});

/** Audits a change to a member by what changed between two readings, when anything did. */
async function auditChange(tenant: Tenant, before: MemberDetail, after: MemberDetail, requestId?: string) {
  const changed = changedValues(audited(before), audited(after), AUDITED);
  if (Object.keys(changed).length === 0) return;
  await logActionSafe(tenant, {
    action: "UPDATE",
    entityType: "clinic_members",
    entityId: after.id,
    changes: changed,
    requestId,
  });
}

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
      ...(changes.doctor && { doctor: doctorColumns(changes.doctor) }),
    },
  });
  if (error) throw fromPostgrestError(error);

  const after = await getMember(tenant, id);
  await auditChange(tenant, before, after, requestId);
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

/**
 * The owner's own doctor profile (plan §3.1, D96, D97), through 0014: whether
 * they also see patients, and their details — the switch first, so turning
 * it on and filling it in can go together. Audited as any member's change.
 */
export async function updateOwnDoctor(
  tenant: Tenant,
  { seesPatients, doctor }: OwnDoctorPayload,
  requestId?: string,
): Promise<MemberDetail> {
  const before = await getMember(tenant, tenant.memberId);
  if (seesPatients !== undefined) {
    const { error } = await tenant.supabase.rpc("set_owner_sees_patients", { p_sees: seesPatients });
    if (error) throw fromPostgrestError(error);
  }
  if (doctor) {
    const { error } = await tenant.supabase.rpc("update_own_doctor", { p_changes: doctorColumns(doctor) });
    if (error) throw fromPostgrestError(error);
  }
  const after = await getMember(tenant, tenant.memberId);
  await auditChange(tenant, before, after, requestId);
  return after;
}
