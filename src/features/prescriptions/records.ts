import { auditedChanges } from "@/lib/audit/changes";
import { logActionsSafe } from "@/lib/audit/auditLog";
import { fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type { SavePrescriptionPayload } from "@/lib/validation";

import { toContent, toRow } from "./content";
import type { PrescriptionRow, PrescriptionSaved } from "./types";

/**
 * A visit's prescription (plan §13; D210 – D217), saved whole by one function
 * in 0021: by the visit's doctor, or typed for them with
 * `prescriptions.write` (D45), refused from an older copy (D206) and until
 * the doctor has a registration number (D213). Audited by what changed — the
 * medicines and advice by name alone, the diagnosis tick by its value (plan
 * §27.6). Waits on two round trips after the session: the function, the
 * audit row (plan §37).
 */

/** What save_prescription hands back: the prescription, whether it made it, and it before and after. */
interface SaveAnswer {
  prescription_id: string;
  created: boolean;
  before: PrescriptionRow | null;
  after: PrescriptionRow;
}

/** The parts of a prescription the trail names; the medicines compared as one. */
const PARTS = ["items", "advice", "print_diagnosis"] as const;
const CLINICAL = ["items", "advice"];

/** A prescription as the trail compares it: its medicines as one value — none while there are none. */
const comparable = (row: PrescriptionRow) => ({
  ...row,
  items: row.items.length === 0 ? null : JSON.stringify(row.items),
});

/** The prescription, whole: what was typed, compared with what the screen had read (D206). */
export async function savePrescription(
  tenant: Tenant,
  visitId: string,
  { prescription, seen }: SavePrescriptionPayload,
  requestId?: string,
): Promise<PrescriptionSaved> {
  const { data, error } = await tenant.supabase.rpc("save_prescription", {
    p_visit_id: visitId,
    p_prescription: toRow(prescription),
    p_seen: seen === null ? null : toRow(seen),
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
        entityType: "prescriptions",
        entityId: answer.prescription_id,
        changes,
        requestId,
      },
    ]);
  }
  return { prescription: toContent(answer.after) };
}
