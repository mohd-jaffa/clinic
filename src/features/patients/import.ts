import { IMPORT_BATCH_SIZE, MAX_PATIENT_MATCHES } from "@/constants/limits";
import { logActionSafe } from "@/lib/audit/auditLog";
import { fromPostgrestError } from "@/lib/errors";
import { getPlatformSettings } from "@/lib/platform/settings";
import type { Tenant } from "@/lib/supabase/tenant";
import type { ImportRowPayload } from "@/lib/validation";

import type { ImportLimits, ImportMatch, ImportResult } from "./types";

/**
 * Importing patients (plan §10.5, D51, D127 – D133): the owner's file is read
 * in the browser and never sent; what arrives here are its checked rows, a
 * batch at a time, and the mobiles asked about before them.
 */

/** How many rows an import may hold — the platform's setting (D128) — and how many each request sends. */
export async function getImportLimits(): Promise<ImportLimits> {
  const { maxImportRows } = await getPlatformSettings();
  return { maxRows: maxImportRows, batchSize: IMPORT_BATCH_SIZE };
}

/**
 * The clinic's patients on any of these mobiles, archived ones too, for the
 * preview's possible duplicates (plan §10.5): a family shares one, so
 * several may come back for one mobile.
 */
export async function findImportMatches(tenant: Tenant, phones: readonly string[]): Promise<ImportMatch[]> {
  const { data, error } = await tenant.supabase
    .from("patients")
    .select("patient_number, full_name, phone")
    .eq("clinic_id", tenant.clinicId)
    .in("phone", [...phones])
    .order("patient_number")
    .limit(IMPORT_BATCH_SIZE * MAX_PATIENT_MATCHES);
  if (error) throw fromPostgrestError(error);
  return (data ?? []).map((row) => ({ phone: row.phone, number: row.patient_number, name: row.full_name }));
}

/**
 * One batch of an import, through `import_patients`: each row a patient as
 * the add sheet makes one, under its own key, so a batch sent again — after
 * the connection dropped — adds no one twice. Audited once for the patients
 * it added: how many and their numbers, never a name (plan §27.6).
 */
export async function importPatients(
  tenant: Tenant,
  rows: readonly ImportRowPayload[],
  requestId?: string,
): Promise<ImportResult> {
  const { data, error } = await tenant.supabase.rpc("import_patients", {
    p_patients: rows.map((row) => ({
      full_name: row.fullName,
      phone: row.phone,
      date_of_birth: row.born.dateOfBirth,
      dob_is_estimated: row.born.dobIsEstimated,
      gender: row.gender,
      alt_phone: row.altPhone,
      email: row.email,
      address: row.address,
      emergency_contact_name: row.emergencyContactName,
      emergency_contact_phone: row.emergencyContactPhone,
      notes: row.notes,
      idempotency_key: row.key,
    })),
  });
  if (error) throw fromPostgrestError(error);

  const answered = (data ?? []) as { patient_id: string; patient_number: number; created: boolean }[];
  const numbers = answered.filter((row) => row.created).map((row) => row.patient_number);
  if (numbers.length > 0) {
    await logActionSafe(tenant, {
      action: "CREATE",
      entityType: "patients",
      entityId: null,
      changes: { imported: numbers.length, patient_number: { from: Math.min(...numbers), to: Math.max(...numbers) } },
      requestId,
    });
  }
  return { imported: answered.length, added: numbers.length };
}
