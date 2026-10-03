import { UI_TEXT } from "@/constants/messages";
import { GENDER_LABELS, type Gender } from "@/constants/statuses";
import { formatAge } from "@/lib/format/age";

/**
 * A patient's line under their name, wherever one is listed (plan §10.2):
 * "34 y · Female · P-1007" — enough to tell one of a family from another.
 */
export function describePatient(patient: { dateOfBirth: string; gender: Gender; number: number }): string {
  return [formatAge(patient.dateOfBirth), GENDER_LABELS[patient.gender], UI_TEXT.patients.number(patient.number)].join(
    " · ",
  );
}
