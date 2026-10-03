import { logActionSafe } from "@/lib/audit/auditLog";
import { fromPostgrestError, notFoundError } from "@/lib/errors";
import { tenantRecords } from "@/lib/supabase/records";
import type { Tenant } from "@/lib/supabase/tenant";
import type { ClosurePayload } from "@/lib/validation";

import type { Closure, ClosureRow } from "./types";

/**
 * Holidays and leave (plan §9, D84 – D87): the days the whole clinic, or one
 * of its doctors, is away. Every member reads them — the calendar shades
 * them and booking refuses them — and whoever holds `settings.manage` adds
 * them while the clinic can write, under the 0011 policies: from today, at
 * most a year, never over another for the same people. One not yet over is
 * removed through `remove_closure`; a past one stays. Each is audited with
 * its values, none of them clinical.
 */
const TABLE = "clinic_closures";

/** The doctor's name comes through their membership's profile (0003's teammates policy). */
const COLUMNS =
  "id, doctor_id, starts_on, ends_on, reason, doctor:doctors(member:clinic_members(profile:profiles!clinic_members_user_id_fkey(full_name)))";

/** The columns a closure is written with, and audited by. */
const WRITTEN = ["doctor_id", "starts_on", "ends_on", "reason"] as const;

const records = (tenant: Tenant) =>
  tenantRecords<ClosureRow>(tenant, TABLE, { columns: COLUMNS, taken: "CLOSURE_DAYS_TAKEN" });

const toClosure = (row: ClosureRow): Closure => ({
  id: row.id,
  doctorId: row.doctor_id,
  doctorName: row.doctor?.member?.profile?.full_name ?? null,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  reason: row.reason,
});

/** Every closure, past ones too, by their first day; the screen splits them at today (D84). */
export async function listClosures(tenant: Tenant): Promise<Closure[]> {
  const rows = await records(tenant).list([{ column: "starts_on" }, { column: "ends_on" }]);
  return rows.map(toClosure);
}

export async function addClosure(tenant: Tenant, closure: ClosurePayload, requestId?: string): Promise<Closure> {
  const row = await records(tenant).insert(
    {
      doctor_id: closure.doctorId,
      starts_on: closure.startsOn,
      ends_on: closure.endsOn,
      reason: closure.reason,
    },
    { requestId },
  );
  return toClosure(row);
}

/** Removes one not yet over (D84), and hands it back for the screen's words. */
export async function removeClosure(tenant: Tenant, id: string, requestId?: string): Promise<Closure> {
  const { data, error } = await tenant.supabase
    .rpc("remove_closure", { p_closure_id: id })
    .select(COLUMNS)
    .maybeSingle<ClosureRow>();
  if (error) throw fromPostgrestError(error);
  if (!data) throw notFoundError("RECORD_NOT_FOUND");

  await logActionSafe(tenant, {
    action: "DELETE",
    entityType: TABLE,
    entityId: data.id,
    changes: Object.fromEntries(WRITTEN.map((column) => [column, { from: data[column], to: null }])),
    requestId,
  });
  return toClosure(data);
}
