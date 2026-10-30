import type { AuditAction } from "@/constants/statuses";

/** A change as the trail holds it: a value from and to, or only the fields named (plan §27.6). */
export type ActivityChanges = Record<string, unknown> & { fields?: string[] };

/**
 * One row of the clinic's activity (plan §19; D387): who did what to which
 * record, when — with the patient it is about and the record it names, as
 * they are now, and the names of the doctors, types and categories its
 * changes point at.
 */
export interface ActivityEntry {
  id: string;
  action: AuditAction;
  /** The table the record is in: "payments", "appointments". */
  entityType: string;
  entityId: string | null;
  changes: ActivityChanges | null;
  at: string;
  /** Who did it, while their profile lasts. */
  actorName: string | null;
  patient: { id: string; number: number; name: string } | null;
  /** What the record is called, as its kind says: a bill's number, an item's name. */
  record: Record<string, unknown> | null;
  /** The name behind each id its changes name. */
  names: Record<string, string>;
}
