import { UI_TEXT } from "@/constants/messages";
import { PRESCRIPTION_TIMING_LABELS } from "@/constants/statuses";

import type {
  EmbeddedPrescriptionRow,
  Prescription,
  PrescriptionContent,
  PrescriptionItem,
  PrescriptionItemRow,
  PrescriptionRow,
} from "./types";

const { prescription: words } = UI_TEXT;

/** A medicine line under the screen's names, in a fixed order. */
export const toItem = (row: PrescriptionItemRow): PrescriptionItem => ({
  medicine: row.medicine,
  strength: row.strength,
  dose: row.dose,
  frequency: row.frequency,
  timing: row.timing,
  durationDays: row.duration_days,
  instructions: row.instructions,
});

/** A medicine line under the database's names, as `prescription_of` (0021) builds it. */
export const toItemRow = (item: PrescriptionItem): PrescriptionItemRow => ({
  medicine: item.medicine,
  strength: item.strength,
  dose: item.dose,
  frequency: item.frequency,
  timing: item.timing,
  duration_days: item.durationDays,
  instructions: item.instructions,
});

/** What a prescription says, under the screen's names, in a fixed order — so two copies compare as text. */
export const toContent = (row: PrescriptionRow): PrescriptionContent => ({
  items: row.items.map(toItem),
  advice: row.advice,
  printDiagnosis: row.print_diagnosis,
});

/** What a prescription says, as the database compares it (D206). */
export const toRow = (content: PrescriptionContent): PrescriptionRow => ({
  items: content.items.map(toItemRow),
  advice: content.advice,
  print_diagnosis: content.printDiagnosis,
});

/**
 * A prescription read with its visit: its medicines in their places, and who
 * typed it — named only when that was not the doctor (`doctorUserId`, D45).
 */
export function fromEmbedded(row: EmbeddedPrescriptionRow, doctorUserId: string | null): Prescription {
  return {
    id: row.id,
    ...toContent({
      items: [...row.items].sort((a, b) => a.position - b.position),
      advice: row.advice,
      print_diagnosis: row.print_diagnosis,
    }),
    typedBy: row.entered_by !== null && row.entered_by !== doctorUserId ? (row.typist?.full_name ?? null) : null,
  };
}

/** A medicine as its line's title: "Paracetamol 500 mg". */
export const medicineTitle = (item: Pick<PrescriptionItem, "medicine" | "strength">) =>
  item.strength ? `${item.medicine} ${item.strength}` : item.medicine;

/** How it is taken, as one line: "1 tab · 1-0-1 · After food · 5 days" — each part only when written. */
export function howTaken(item: PrescriptionItem): string {
  return [
    item.dose,
    item.frequency,
    item.timing && PRESCRIPTION_TIMING_LABELS[item.timing],
    item.durationDays !== null && words.days(item.durationDays),
  ]
    .filter(Boolean)
    .join(" · ");
}
