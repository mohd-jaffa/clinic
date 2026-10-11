import type { PatientInput } from "@/lib/validation";

/** What a new patient starts with beside the blanks. */
export type PatientPrefill = Partial<Pick<PatientInput, "fullName" | "phone">>;

/** What a search that found no one fills a new patient with (D112): a mobile typed, or a name. */
export function prefillFrom(search: string): PatientPrefill {
  if (/^[\d\s()+-]+$/.test(search)) return { phone: search };
  return /\d/.test(search) ? {} : { fullName: search };
}
