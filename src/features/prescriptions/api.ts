import { fromPostgrestError } from "@/lib/errors";
import type { Tenant } from "@/lib/supabase/tenant";
import type { MedicineSearchPayload } from "@/lib/validation";

import { toItem } from "./content";
import type { PrescriptionItem, PrescriptionItemRow } from "./types";

/**
 * The medicines this clinic has written beginning with what is typed (plan
 * §13, D211) — no drug database — one for each medicine and strength, with
 * its line as last written: by this doctor first, else by anyone in the
 * clinic. For a doctor, or whoever types for one; one round trip after the
 * session, on 0021's index (plan §37).
 */
export async function medicineSuggestions(
  tenant: Tenant,
  { q, doctorId }: MedicineSearchPayload,
): Promise<PrescriptionItem[]> {
  const { data, error } = await tenant.supabase.rpc("medicine_suggestions", {
    p_search: q,
    p_doctor_id: doctorId,
  });
  if (error) throw fromPostgrestError(error);
  return (data as PrescriptionItemRow[]).map(toItem);
}
