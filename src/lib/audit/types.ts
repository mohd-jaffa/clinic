import type { AuditAction } from "@/constants/statuses";

/**
 * One change, as the feature that made it describes it (AGENTS.md §14). The
 * clinic and the person acting are not part of it: the audit logger takes
 * both from the tenant, never from the entry.
 */
export interface AuditEntry {
  action: AuditAction;
  /** The table the row belongs to. */
  entityType: string;
  entityId: string | null;
  /**
   * What changed: `{ field: { from, to } }` for values that are not clinical,
   * the field names alone for clinical text (plan §27.6).
   */
  changes?: Record<string, unknown> | null;
  /** A line for the activity log; never a patient's name. */
  summary?: string | null;
  /** The request it was part of, to find its log lines. */
  requestId?: string | null;
}
