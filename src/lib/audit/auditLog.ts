import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/supabase/tenant";

import { captureError } from "./errorLog";
import type { AuditEntry } from "./types";

/** An entry as the trail stores it, with the clinic and the person acting taken from the tenant. */
const rowOf = (tenant: Tenant, entry: AuditEntry) => ({
  clinic_id: tenant.clinicId,
  actor_id: tenant.actorId,
  action: entry.action,
  entity_type: entry.entityType,
  entity_id: entry.entityId,
  changes: entry.changes ?? null,
  summary: entry.summary ?? null,
  request_id: entry.requestId ?? null,
});

/** A trail row that could not be written, logged rather than failing the request. */
async function failed(tenant: Tenant, entry: AuditEntry, error: unknown) {
  await captureError({
    message: "Failed to write audit log",
    error,
    userId: tenant.actorId,
    clinicId: tenant.clinicId,
    reference: entry.requestId ?? undefined,
    context: { action: entry.action, entityType: entry.entityType, entityId: entry.entityId },
  });
}

/**
 * Records a mutation of the clinic's records (AGENTS.md §14). The trail is
 * written by the server only: a member may not write one, so the row goes in
 * through the service role, with the clinic and the person acting taken from
 * the tenant the route built from the session — never from the entry.
 *
 * A failure is logged and swallowed: the change it describes has already
 * happened, and refusing it now would report a failure that did not occur.
 */
export async function logActionSafe(tenant: Tenant, entry: AuditEntry): Promise<void> {
  const { error } = await createSupabaseServiceRoleClient().from("audit_logs").insert(rowOf(tenant, entry));
  if (error) await failed(tenant, entry, error);
}

/**
 * Records the rows of one change that touched several records — an
 * appointment and its visit — in one insert, so the change waits on one
 * round trip for its trail, not one for each (plan §37.1). Nothing to record
 * writes nothing. A failure is logged and swallowed, as for one row.
 */
export async function logActionsSafe(tenant: Tenant, entries: readonly AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await createSupabaseServiceRoleClient()
    .from("audit_logs")
    .insert(entries.map((entry) => rowOf(tenant, entry)));
  if (error) await failed(tenant, entries[0], error);
}
