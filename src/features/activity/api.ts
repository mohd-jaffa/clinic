import { PAGE_SIZE } from "@/constants/limits";
import { ACTIVITY_KIND_TABLES, type AuditAction } from "@/constants/statuses";
import { toPage, type Page } from "@/lib/api/pagination";
import { fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type { ActivityQuery } from "@/lib/validation";

import type { ActivityChanges, ActivityEntry } from "./types";

/** What `clinic_activity` (0038) hands back for each row. */
export interface ActivityRow {
  id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  changes: ActivityChanges | null;
  created_at: string;
  actor_name: string | null;
  patient: { id: string; number: number; name: string } | null;
  record: Record<string, unknown> | null;
  names: Record<string, string>;
}

export const toActivityEntry = (row: ActivityRow): ActivityEntry => ({
  id: row.id,
  action: row.action,
  entityType: row.entity_type,
  entityId: row.entity_id,
  changes: row.changes,
  at: row.created_at,
  actorName: row.actor_name,
  patient: row.patient,
  record: row.record,
  names: row.names,
});

/**
 * A page of the clinic's activity (plan §19; D387 – D390), the latest first:
 * one call, which reads each row with its patient and the record it names.
 * The owner's alone; the database checks it again.
 */
export async function listActivity(
  tenant: Tenant,
  { person, kind, cursor }: ActivityQuery,
): Promise<Page<ActivityEntry>> {
  const start = cursor ?? 0;
  const { data, error } = await tenant.supabase.rpc("clinic_activity", {
    p_actor: person ?? null,
    p_entity_types: kind ? ACTIVITY_KIND_TABLES[kind] : null,
    p_offset: start,
    p_limit: PAGE_SIZE + 1,
  });
  if (error) throw fromPostgrestError(error);
  return toPage((data as ActivityRow[]).map(toActivityEntry), start);
}
