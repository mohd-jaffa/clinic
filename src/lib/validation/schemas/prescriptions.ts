import * as z from "zod";

import { PRESCRIPTION_DAYS } from "@/constants/clinical";
import { PRESCRIPTION_MAX_ITEMS, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { PRESCRIPTION_TIMINGS } from "@/constants/statuses";

import { optionalLine, optionalLines, optionalWholeNumberText, requiredLine } from "../primitives";

const { prescription: words } = UI_TEXT;

/** When it is taken: one of PRESCRIPTION_TIMINGS, or none — blank is none. */
const timing = z
  .union([z.enum(PRESCRIPTION_TIMINGS), z.literal(""), z.null()], { error: VALIDATION_MESSAGES.invalid })
  .optional()
  .transform((chosen) => (chosen ? chosen : null));

/**
 * One medicine as typed (plan §13): its name, and each of the rest if
 * written — the frequency a chip's words or typed (D214), the days a whole
 * number (D217) — each bounded as 0021's columns are.
 */
export const prescriptionItemSchema = z.object({
  medicine: requiredLine(words.medicineLabel, { max: TEXT_LIMITS.medicine }),
  strength: optionalLine(words.strengthLabel, TEXT_LIMITS.strength),
  dose: optionalLine(words.doseLabel, TEXT_LIMITS.dose),
  frequency: optionalLine(words.frequencyLabel, TEXT_LIMITS.frequency),
  timing,
  durationDays: optionalWholeNumberText(words.daysLabel, PRESCRIPTION_DAYS),
  instructions: optionalLine(words.instructionsLabel, TEXT_LIMITS.instructions),
});

export type PrescriptionItemInput = z.input<typeof prescriptionItemSchema>;

/** A prescription as typed (D210): its medicines in order, the advice, and the diagnosis tick (D216). */
export const prescriptionSchema = z.object({
  items: z
    .array(prescriptionItemSchema, { error: VALIDATION_MESSAGES.invalid })
    .max(PRESCRIPTION_MAX_ITEMS, { error: VALIDATION_MESSAGES.atMostMedicines(PRESCRIPTION_MAX_ITEMS) }),
  advice: optionalLines(words.adviceLabel, TEXT_LIMITS.advice),
  printDiagnosis: z.boolean({ error: VALIDATION_MESSAGES.invalid }),
});

export type PrescriptionInput = z.input<typeof prescriptionSchema>;
export type PrescriptionPayload = z.output<typeof prescriptionSchema>;

/** A medicine as the screen last read it: as saved, each part or none. */
const seenItem = z.object({
  medicine: z.string(),
  strength: z.string().nullable(),
  dose: z.string().nullable(),
  frequency: z.string().nullable(),
  timing: z.enum(PRESCRIPTION_TIMINGS).nullable(),
  durationDays: z.number().int().nullable(),
  instructions: z.string().nullable(),
});

/**
 * Saving a prescription (D210, D206): what was typed, and the prescription as
 * the screen had read it — none when there was none — so a save made from an
 * older copy is refused rather than writing over another's.
 */
export const savePrescriptionSchema = z.object(
  {
    prescription: prescriptionSchema,
    seen: z
      .object({
        items: z.array(seenItem).max(PRESCRIPTION_MAX_ITEMS),
        advice: z.string().nullable(),
        printDiagnosis: z.boolean(),
      })
      .nullable(),
  },
  { error: VALIDATION_MESSAGES.invalid },
);

export type SavePrescriptionInput = z.input<typeof savePrescriptionSchema>;
export type SavePrescriptionPayload = z.output<typeof savePrescriptionSchema>;

/**
 * The medicine suggestions asked for (D211): what is typed of a name, and the
 * doctor whose own lines come first.
 */
export const medicineSearchSchema = z.object({
  q: requiredLine(words.medicineLabel, { max: TEXT_LIMITS.medicine }),
  doctorId: z.uuid({ error: VALIDATION_MESSAGES.invalid }),
});

export type MedicineSearchInput = z.input<typeof medicineSearchSchema>;
export type MedicineSearchPayload = z.output<typeof medicineSearchSchema>;
