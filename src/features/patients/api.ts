import { MAX_PATIENT_MATCHES } from "@/constants/limits";
import { logActionSafe } from "@/lib/audit/auditLog";
import { auditedChanges } from "@/lib/audit/changes";
import { fromPostgrestError } from "@/lib/errors";
import { tenantRecords } from "@/lib/supabase/records";
import type { Tenant } from "@/lib/supabase/tenant";
import type { PatientPayload, UpdatePatientPayload } from "@/lib/validation";

import type { Patient, PatientMatch, PatientRow } from "./types";

/**
 * Patients (plan §10.1): added through `create_patient` — numbered, on the
 * doctor scope's list, once per idempotency key — and read and changed under
 * the 0015 policies, so a doctor reaches only their own (D3). An archived
 * patient is read-only until restored (D103), refused by the database.
 *
 * A patient's own details are audited by their field names alone; only the
 * number and the assigned doctor by value (plan §27.6).
 */
const TABLE = "patients";

/** The doctor's name comes through their membership's profile (0003's teammates policy). */
const COLUMNS =
  "id, patient_number, full_name, phone, alt_phone, email, date_of_birth, dob_is_estimated, gender, address, emergency_contact_name, emergency_contact_phone, assigned_doctor_id, notes, archived_at, doctor:doctors!patients_assigned_doctor_id_clinic_id_fkey(member:clinic_members(profile:profiles!clinic_members_user_id_fkey(full_name)))";

/** A patient's own details: in the audit trail by name, never by value. */
const PERSONAL = [
  "full_name",
  "phone",
  "alt_phone",
  "email",
  "date_of_birth",
  "dob_is_estimated",
  "gender",
  "address",
  "emergency_contact_name",
  "emergency_contact_phone",
  "notes",
] as const;

const records = (tenant: Tenant) => tenantRecords<PatientRow>(tenant, TABLE, { columns: COLUMNS, named: PERSONAL });

export const toPatient = (row: PatientRow): Patient => ({
  id: row.id,
  number: row.patient_number,
  name: row.full_name,
  phone: row.phone,
  altPhone: row.alt_phone,
  email: row.email,
  dateOfBirth: row.date_of_birth,
  dobIsEstimated: row.dob_is_estimated,
  gender: row.gender,
  address: row.address,
  emergencyContactName: row.emergency_contact_name,
  emergencyContactPhone: row.emergency_contact_phone,
  assignedDoctorId: row.assigned_doctor_id,
  doctorName: row.doctor?.member?.profile?.full_name ?? null,
  notes: row.notes,
  archived: row.archived_at !== null,
});

/** The columns a patient's fields are written to: only the fields given. */
function toColumns(patient: Partial<PatientPayload> | UpdatePatientPayload): Record<string, unknown> {
  const columns: Record<string, unknown> = {
    full_name: patient.fullName,
    phone: patient.phone,
    date_of_birth: patient.born?.dateOfBirth,
    dob_is_estimated: patient.born?.dobIsEstimated,
    gender: patient.gender,
    assigned_doctor_id: patient.assignedDoctorId,
    alt_phone: patient.altPhone,
    email: patient.email,
    address: patient.address,
    emergency_contact_name: patient.emergencyContactName,
    emergency_contact_phone: patient.emergencyContactPhone,
    notes: patient.notes,
  };
  return Object.fromEntries(Object.entries(columns).filter(([, value]) => value !== undefined));
}

export async function getPatient(tenant: Tenant, id: string): Promise<Patient> {
  return toPatient(await records(tenant).find(id));
}

/**
 * Adds a patient (plan §10.1). The same key sent again finds the patient the
 * first made, audited once.
 */
export async function createPatient(
  tenant: Tenant,
  patient: PatientPayload,
  idempotencyKey: string,
  requestId?: string,
): Promise<Patient> {
  const values = toColumns(patient);
  const { data, error } = await tenant.supabase
    .rpc("create_patient", { p_patient: values, p_idempotency_key: idempotencyKey })
    .single<{ patient_id: string; created: boolean }>();
  if (error) throw fromPostgrestError(error);

  const row = await records(tenant).find(data.patient_id);
  if (data.created) {
    await logActionSafe(tenant, {
      action: "CREATE",
      entityType: TABLE,
      entityId: row.id,
      changes: auditedChanges(
        null,
        row,
        ["patient_number", ...(Object.keys(values) as (keyof PatientRow)[])],
        PERSONAL,
      ),
      requestId,
    });
  }
  return toPatient(row);
}

/** Changes the fields sent (plan §10.1); refused while the patient is archived (D103). */
export async function updatePatient(
  tenant: Tenant,
  id: string,
  changes: UpdatePatientPayload,
  requestId?: string,
): Promise<Patient> {
  return toPatient(await records(tenant).update(id, toColumns(changes), { requestId }));
}

/**
 * "Already here?" (plan §10.1, D106): the patients with this mobile that the
 * caller may see — a family shares one — newest first, the archived among
 * them marked.
 */
export async function findPatientMatches(tenant: Tenant, phone: string): Promise<PatientMatch[]> {
  const { data, error } = await tenant.supabase
    .from(TABLE)
    .select("id, patient_number, full_name, date_of_birth, gender, archived_at")
    .eq("clinic_id", tenant.clinicId)
    .eq("phone", phone)
    .order("patient_number", { ascending: false })
    .limit(MAX_PATIENT_MATCHES);
  if (error) throw fromPostgrestError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    number: row.patient_number,
    name: row.full_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    archived: row.archived_at !== null,
  }));
}
