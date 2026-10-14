import type { PatientAlert } from "@/features/patients/types";

/**
 * The patient's active allergies a medicine's name contains (plan §13, D212):
 * "Penicillin" in "Penicillin V", whatever the case. A match of words, not a
 * clinical check — "Amoxicillin" does not match a penicillin allergy — so it
 * warns, and never refuses.
 */
export function allergiesIn(medicine: string, alerts: readonly PatientAlert[]): string[] {
  const name = medicine.trim().toLowerCase();
  if (name === "") return [];
  return alerts
    .filter((alert) => alert.active && alert.kind === "ALLERGY" && name.includes(alert.label.trim().toLowerCase()))
    .map((alert) => alert.label);
}
