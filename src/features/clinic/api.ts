import { LOGO_BUCKET, type LogoMimeType } from "@/constants/uploads";
import { logActionSafe } from "@/lib/audit/auditLog";
import { externalServiceError, fromPostgrestError, notFoundError, validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { Tenant } from "@/lib/supabase/tenant";
import type { UpdateClinicPayload } from "@/lib/validation";

import { logoPath, logoUrl, logoVersion, SIGNATURE_BYTES, sniffLogoType } from "./logo";
import type { ClinicProfile, ClinicRow } from "./types";

/**
 * The clinic's profile and its logo (plan §9, D78, D79). Read with the
 * caller's client, so RLS shows only their clinic. `clinics` is SELECT-only
 * for that client: a change goes through the functions in
 * 0009_clinic_profile.sql, which ask for `settings.manage` and a clinic that
 * can write. Every change is audited, its values with it — none is clinical.
 */
const COLUMNS =
  "id, name, clinic_type, phone, email, address, city, gstin, timezone, paper_size, fee_timing, logo_path";

export function toClinicProfile(row: ClinicRow): ClinicProfile {
  return {
    id: row.id,
    name: row.name,
    clinicType: row.clinic_type,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    gstin: row.gstin,
    timezone: row.timezone,
    paperSize: row.paper_size,
    feeTiming: row.fee_timing,
    logoUrl: logoUrl(row.logo_path),
  };
}

async function findClinic({ supabase, clinicId }: Tenant): Promise<ClinicRow> {
  const { data, error } = await supabase.from("clinics").select(COLUMNS).eq("id", clinicId).maybeSingle<ClinicRow>();
  if (error) throw fromPostgrestError(error);
  if (!data) throw notFoundError("RECORD_NOT_FOUND");
  return data;
}

export async function getClinic(tenant: Tenant): Promise<ClinicProfile> {
  return toClinicProfile(await findClinic(tenant));
}

/** The columns a change names, from what the route accepted. */
function columnsOf({ details, paperSize, feeTiming }: UpdateClinicPayload): Partial<ClinicRow> {
  return {
    ...(details && {
      name: details.name,
      clinic_type: details.clinicType,
      address: details.address,
      city: details.city,
      phone: details.phone,
      email: details.email,
      gstin: details.gstin,
    }),
    ...(paperSize && { paper_size: paperSize }),
    ...(feeTiming && { fee_timing: feeTiming }),
  };
}

/** Each column that really changed, from what to what. */
function changed(before: ClinicRow, after: ClinicRow, columns: readonly (keyof ClinicRow)[]) {
  return Object.fromEntries(
    columns.filter((column) => before[column] !== after[column]).map((c) => [c, { from: before[c], to: after[c] }]),
  );
}

/** Its details, its paper size or its fee timing; what is left out stays as it is. */
export async function updateClinic(
  tenant: Tenant,
  payload: UpdateClinicPayload,
  requestId?: string,
): Promise<ClinicProfile> {
  const columns = columnsOf(payload);
  const before = await findClinic(tenant);
  if (Object.keys(columns).length === 0) return toClinicProfile(before);

  const { data: after, error } = await tenant.supabase
    .rpc("update_clinic_profile", { p_changes: columns })
    .select(COLUMNS)
    .maybeSingle<ClinicRow>();
  if (error) throw fromPostgrestError(error);
  if (!after) throw notFoundError("RECORD_NOT_FOUND");

  const changes = changed(before, after, Object.keys(columns) as (keyof ClinicRow)[]);
  if (Object.keys(changes).length > 0) {
    await logActionSafe(tenant, {
      action: "UPDATE",
      entityType: "clinics",
      entityId: tenant.clinicId,
      changes,
      requestId,
    });
  }
  return toClinicProfile(after);
}

/** A file nothing refers to any more. Failing to remove one is logged, not fatal. */
async function removeLogoFile({ supabase, clinicId }: Tenant, path: string) {
  const { error } = await supabase.storage.from(LOGO_BUCKET).remove([path]);
  if (error) logger.warn("Logo file not removed", { clinicId, logoId: logoVersion(path), reason: error.message });
}

const auditLogo = (tenant: Tenant, from: string | null, to: string | null, requestId?: string) =>
  logActionSafe(tenant, {
    action: "UPDATE",
    entityType: "clinics",
    entityId: tenant.clinicId,
    changes: { logo: { from: from && logoVersion(from), to: to && logoVersion(to) } },
    requestId,
  });

/**
 * A new logo, in the order AGENTS.md §20 sets: the file is checked by its
 * first bytes, stored as a new file, the clinic is pointed at it, and only
 * then is the old file removed. A failure before the switch takes the new
 * file away again and leaves the old logo in place, so there is never a
 * moment with no logo, or two. The size was checked as the body was read.
 */
export async function replaceLogo(tenant: Tenant, file: Uint8Array, requestId?: string): Promise<ClinicProfile> {
  const type = sniffLogoType(file);
  if (!type) throw validationError("LOGO_TYPE_NOT_ALLOWED");

  const path = logoPath(tenant.clinicId, crypto.randomUUID());
  const bucket = tenant.supabase.storage.from(LOGO_BUCKET);
  const stored = await bucket.upload(path, file, { contentType: type, upsert: false });
  if (stored.error) throw externalServiceError("LOGO_UPLOAD_FAILED", undefined, stored.error);

  const switched = await tenant.supabase.rpc("set_clinic_logo", { p_path: path });
  if (switched.error) {
    await removeLogoFile(tenant, path);
    throw fromPostgrestError(switched.error);
  }

  const previous = switched.data as string | null;
  if (previous) await removeLogoFile(tenant, previous);
  await auditLogo(tenant, previous, path, requestId);
  return getClinic(tenant);
}

/** No logo (D79): the clinic lets go of it first, then its file is removed. */
export async function removeLogo(tenant: Tenant, requestId?: string): Promise<ClinicProfile> {
  const { data, error } = await tenant.supabase.rpc("clear_clinic_logo");
  if (error) throw fromPostgrestError(error);

  const previous = data as string | null;
  if (previous) {
    await removeLogoFile(tenant, previous);
    await auditLogo(tenant, previous, null, requestId);
  }
  return getClinic(tenant);
}

/** The current logo, for /api/clinic/logo to answer with, typed by its own first bytes. */
export async function readLogo(tenant: Tenant): Promise<{ file: Blob; type: LogoMimeType }> {
  const { logo_path: path } = await findClinic(tenant);
  if (!path) throw notFoundError();

  const { data: file, error } = await tenant.supabase.storage.from(LOGO_BUCKET).download(path);
  if (error || !file) throw externalServiceError("EXTERNAL_SERVICE_ERROR", undefined, error);
  const type = sniffLogoType(new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer()));
  if (!type) throw externalServiceError("EXTERNAL_SERVICE_ERROR");
  return { file, type };
}
