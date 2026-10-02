import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/supabase/tenant";

import { captureError } from "./errorLog";
import type { AuditEntry } from "./types";

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
  const { error } = await createSupabaseServiceRoleClient()
    .from("audit_logs")
    .insert({
      clinic_id: tenant.clinicId,
      actor_id: tenant.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      changes: entry.changes ?? null,
      summary: entry.summary ?? null,
      request_id: entry.requestId ?? null,
    });

  if (error) {
    await captureError({
      message: "Failed to write audit log",
      error,
      userId: tenant.actorId,
      clinicId: tenant.clinicId,
      reference: entry.requestId ?? undefined,
      context: { action: entry.action, entityType: entry.entityType, entityId: entry.entityId },
    });
  }
}
