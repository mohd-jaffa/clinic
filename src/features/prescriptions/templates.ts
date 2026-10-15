import { logActionsSafe } from "@/lib/audit/auditLog";
import { auditedChanges } from "@/lib/audit/changes";
import { fromPostgrestError } from "@/lib/errors";
import { tenantRecords } from "@/lib/supabase/records";
import type { Tenant } from "@/lib/supabase/tenant";
import type { ChangeTemplatePayload, SaveTemplatePayload, TemplatePayload } from "@/lib/validation";

import { toItem, toItemRow } from "./content";
import { templatesKey } from "./keys";
import type { PrescriptionTemplate, PrescriptionTemplateContentRow, PrescriptionTemplateRow } from "./types";

/**
 * A doctor's prescription templates (plan §13; D54, D240 – D243): read by
 * the doctor and by whoever types for them (`prescriptions.write`), under
 * 0023's policies; made and changed whole by the doctor alone through
 * `save_prescription_template`, archived and restored by its `active`
 * (D242). Audited by what changed — the name by its value, the medicines and
 * advice by name alone (plan §27.6).
 */
const TABLE = "prescription_templates";

/** A template and its medicines, in one query. */
const COLUMNS =
  "id, name, advice, active, " +
  "items:prescription_template_items(position, medicine, strength, dose, frequency, timing, duration_days, instructions)";

/** The parts of a template the trail names; the medicines compared as one. */
const PARTS = ["name", "items", "advice"] as const;
const CLINICAL = ["items", "advice"];

/** What save_prescription_template hands back: the template, whether it made it, and it before and after. */
interface SaveAnswer {
  template_id: string;
  created: boolean;
  before: PrescriptionTemplateContentRow | null;
  after: PrescriptionTemplateContentRow;
}

/** A template under the screen's names, its medicines in their places. */
const toTemplate = (row: PrescriptionTemplateRow): PrescriptionTemplate => ({
  id: row.id,
  name: row.name,
  advice: row.advice,
  active: row.active,
  items: [...row.items].sort((a, b) => a.position - b.position).map(toItem),
});

/** By name, as a person reads a list: case and accents aside. */
const byName = (a: PrescriptionTemplate, b: PrescriptionTemplate) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/** A template as the trail compares it: its medicines as one value — none while there are none. */
const comparable = (row: PrescriptionTemplateContentRow) => ({
  ...row,
  items: row.items.length === 0 ? null : JSON.stringify(row.items),
});

/**
 * A doctor's templates, archived ones too, by name (D241, D242): the doctor's
 * own, or any doctor's for `prescriptions.write` — none for anyone else. One
 * round trip after the session, on 0023's index (plan §37).
 */
export async function listTemplates(tenant: Tenant, doctorId: string): Promise<PrescriptionTemplate[]> {
  const { data, error } = await tenant.supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("doctor_id", doctorId);
  if (error) throw fromPostgrestError(error);
  return (data as unknown as PrescriptionTemplateRow[]).map(toTemplate).sort(byName);
}

/**
 * The doctor's own templates, as their screens in My account first read them
 * (D242) — nothing for a member who is not a doctor.
 */
export function ownTemplates(tenant: Tenant): Record<string, (member: Tenant) => Promise<PrescriptionTemplate[]>> {
  const { doctorId } = tenant;
  return doctorId === null ? {} : { [templatesKey(doctorId)]: (member) => listTemplates(member, doctorId) };
}

/** The template as the database takes it. */
const toRow = ({ name, advice, items }: TemplatePayload) => ({ name, advice, items: items.map(toItemRow) });

/**
 * The doctor's own template, whole (D240): a new one — replacing theirs of
 * the same name only once asked (D243) — or `id`'s changed. Two round trips
 * after the session: the function, the audit row (plan §37).
 */
async function save(
  tenant: Tenant,
  id: string | null,
  template: TemplatePayload,
  replace: boolean,
  requestId?: string,
): Promise<PrescriptionTemplate> {
  const { data, error } = await tenant.supabase.rpc("save_prescription_template", {
    p_template_id: id,
    p_template: toRow(template),
    p_replace: replace,
  });
  if (error) throw fromPostgrestError(error);
  const answer = data as SaveAnswer;
  const changes = auditedChanges(
    answer.before === null ? null : comparable(answer.before),
    comparable(answer.after),
    PARTS,
    CLINICAL,
  );
  if (answer.created || Object.keys(changes).length > 0) {
    await logActionsSafe(tenant, [
      {
        action: answer.created ? "CREATE" : "UPDATE",
        entityType: TABLE,
        entityId: answer.template_id,
        changes,
        requestId,
      },
    ]);
  }
  return {
    id: answer.template_id,
    name: answer.after.name,
    advice: answer.after.advice,
    active: answer.after.active,
    items: answer.after.items.map(toItem),
  };
}

/** A new template (D243), from a visit or My account. */
export const addTemplate = (tenant: Tenant, { template, replace }: SaveTemplatePayload, requestId?: string) =>
  save(tenant, null, template, replace, requestId);

/**
 * A change to one of the doctor's templates (D242): its name, medicines and
 * advice — a name in use refused — or archiving or restoring it, a restore
 * refused when another in use has its name (D243). Archiving is three round
 * trips: the template, the change, the audit row.
 */
export async function changeTemplate(
  tenant: Tenant,
  id: string,
  change: ChangeTemplatePayload,
  requestId?: string,
): Promise<PrescriptionTemplate> {
  if ("template" in change) return save(tenant, id, change.template, false, requestId);
  const records = tenantRecords<PrescriptionTemplateRow>(tenant, TABLE, {
    columns: COLUMNS,
    taken: "TEMPLATE_NAME_TAKEN",
  });
  const row = await records.update(
    id,
    { active: change.active },
    { action: change.active ? "RESTORE" : "ARCHIVE", requestId },
  );
  return toTemplate(row);
}
