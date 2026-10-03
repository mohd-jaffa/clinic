import type { PostgrestError, PostgrestMaybeSingleResponse } from "@supabase/supabase-js";

import type { ErrorMessageCode } from "@/constants/messages";
import type { AuditAction } from "@/constants/statuses";
import { logActionSafe } from "@/lib/audit/auditLog";
import { changedValues } from "@/lib/audit/changes";
import { AppError } from "@/lib/errors/AppError";
import { fromPostgrestError, kindOf } from "@/lib/errors/fromSupabaseError";

import type { Tenant } from "./tenant";

/**
 * One clinic's rows in one table (ported from Brio). A feature whose writes
 * are single rows under their table's policies goes through here, so three
 * things hold everywhere without each feature restating them (AGENTS.md §7,
 * §14):
 *
 * - every query is scoped to the tenant's clinic, beneath the RLS policies
 *   rather than instead of them;
 * - every write asks for its row back, so a row RLS hides reads as a refusal
 *   and never as success;
 * - every change is audited, the values of the columns it wrote from what to
 *   what, by the tenant's actor. Not for clinical text, whose audit names its
 *   fields only (plan §27.6).
 *
 * A write that runs into a unique name answers `taken`, in the feature's own
 * words; a refusal the database raises (a trigger's hint) keeps its code.
 */
export interface OrderBy {
  column: string;
  ascending?: boolean;
}

export interface RecordsOptions {
  /** The columns read and handed back. */
  columns: string;
  /** What a second row with the same unique value is refused as. */
  taken?: ErrorMessageCode;
}

export interface WriteOptions {
  /** What the audit row calls the change; UPDATE unless it is an archive or a restore. */
  action?: AuditAction;
  requestId?: string;
}

type Values = Record<string, unknown>;

export interface TenantRecords<Row extends { id: string }> {
  list(orderBy?: readonly OrderBy[]): Promise<Row[]>;
  find(id: string): Promise<Row>;
  insert(values: Values, options?: WriteOptions): Promise<Row>;
  update(id: string, patch: Values, options?: WriteOptions): Promise<Row>;
}

export function tenantRecords<Row extends { id: string }>(
  tenant: Tenant,
  table: string,
  { columns, taken }: RecordsOptions,
): TenantRecords<Row> {
  const { supabase, clinicId } = tenant;

  const refusal = (error: PostgrestError) =>
    taken && error.code === "23505"
      ? new AppError({ kind: kindOf(taken), code: taken, cause: error })
      : fromPostgrestError(error);

  /** The one row a query or a write by id answers with — or why there is none. */
  async function one(query: PromiseLike<PostgrestMaybeSingleResponse<Row>>): Promise<Row> {
    const { data, error } = await query;
    if (error) throw refusal(error);
    if (data === null) throw new AppError({ kind: "NOT_FOUND", code: "RECORD_NOT_FOUND" });
    return data;
  }

  const audit = (action: AuditAction, row: Row, changes: Values, requestId?: string) =>
    logActionSafe(tenant, { action, entityType: table, entityId: row.id, changes, requestId });

  const find = (id: string) =>
    one(supabase.from(table).select(columns).eq("clinic_id", clinicId).eq("id", id).maybeSingle<Row>());

  return {
    async list(orderBy = []) {
      let query = supabase.from(table).select(columns).eq("clinic_id", clinicId);
      for (const { column, ascending = true } of orderBy) query = query.order(column, { ascending });
      const { data, error } = await query;
      if (error) throw refusal(error);
      return (data ?? []) as unknown as Row[];
    },

    find,

    async insert(values, { requestId } = {}) {
      const row = await one(
        supabase
          .from(table)
          .insert({ ...values, clinic_id: clinicId })
          .select(columns)
          .maybeSingle<Row>(),
      );
      await audit("CREATE", row, changedValues(null, row, Object.keys(values) as (keyof Row & string)[]), requestId);
      return row;
    },

    async update(id, patch, { action = "UPDATE", requestId } = {}) {
      const before = await find(id);
      if (Object.keys(patch).length === 0) return before;

      const after = await one(
        supabase.from(table).update(patch).eq("clinic_id", clinicId).eq("id", id).select(columns).maybeSingle<Row>(),
      );
      const changes = changedValues(before, after, Object.keys(patch) as (keyof Row & string)[]);
      if (Object.keys(changes).length > 0) await audit(action, after, changes, requestId);
      return after;
    },
  };
}
