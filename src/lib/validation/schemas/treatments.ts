import * as z from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { TREATMENT_START_STATUSES, TREATMENT_STATUSES } from "@/constants/statuses";

import { optionalDay, optionalLine, optionalLines, optionalPaiseText, requiredLine } from "../primitives";

const { treatments: words, appointments } = UI_TEXT;

/** A next due day as a form checks it: today or later, as the database holds it (0024). */
function dueFromToday(nextDueOn: string | null, today: string, ctx: z.core.$RefinementCtx) {
  if (nextDueOn !== null && nextDueOn < today) {
    ctx.addIssue({
      code: "custom",
      path: ["nextDueOn"],
      message: VALIDATION_MESSAGES.notBeforeToday(words.nextDueLabel),
    });
  }
}

/**
 * A treatment's details as its form holds them (plan §14.1, D258): its name —
 * a procedure from the price list, or typed — what it is, and the estimate,
 * in rupees as typed, read into paise.
 */
export const treatmentDetailsSchema = z.object({
  name: requiredLine(words.nameLabel, { max: TEXT_LIMITS.treatmentName }),
  description: optionalLines(words.descriptionLabel, TEXT_LIMITS.treatmentDescription),
  estimatedCost: optionalPaiseText(words.estimateLabel),
});

/**
 * A new treatment (plan §14.1; D252, D258): in a visit (`visitId`), that
 * visit's doctor's, begun today with what was done — its first session — or
 * planned; from the profile, for the doctor chosen. Its next due day may be
 * set at once.
 */
export const newTreatmentSchema = treatmentDetailsSchema
  .extend({
    patientId: z.uuid({ error: VALIDATION_MESSAGES.invalid }),
    visitId: z.uuid({ error: VALIDATION_MESSAGES.invalid }).nullable(),
    doctorId: z.union([z.uuid(), z.literal("")], { error: VALIDATION_MESSAGES.choose(appointments.doctorLabel) }),
    start: z.enum(TREATMENT_START_STATUSES, { error: VALIDATION_MESSAGES.choose(words.startLabel) }),
    note: optionalLines(words.firstNoteLabel, TEXT_LIMITS.sessionNote),
    nextDueOn: optionalDay(words.nextDueLabel),
  })
  .superRefine(({ visitId, doctorId }, ctx) => {
    if (visitId === null && doctorId === "") {
      ctx.addIssue({
        code: "custom",
        path: ["doctorId"],
        message: VALIDATION_MESSAGES.choose(appointments.doctorLabel),
      });
    }
  })
  .transform(({ doctorId, note, ...treatment }) => ({
    ...treatment,
    // In a visit the doctor is the visit's; a note is the first session's, only when begun in one.
    doctorId: treatment.visitId === null ? doctorId : null,
    note: treatment.visitId !== null && treatment.start === "IN_PROGRESS" ? note : null,
  }));

export type NewTreatmentInput = z.input<typeof newTreatmentSchema>;
export type NewTreatmentPayload = z.output<typeof newTreatmentSchema>;

/** A new treatment as its sheet checks it: the next due day today or later. */
export const newTreatmentFormSchema = (today: string) =>
  newTreatmentSchema.superRefine(({ nextDueOn }, ctx) => dueFromToday(nextDueOn, today, ctx));

/** A treatment's details, edited (D251, D252): its own, and its doctor — handed to another while it is open. */
export const treatmentEditSchema = treatmentDetailsSchema.extend({
  doctorId: z.uuid({ error: VALIDATION_MESSAGES.choose(appointments.doctorLabel) }),
});

export type TreatmentEditInput = z.input<typeof treatmentEditSchema>;
export type TreatmentEditPayload = z.output<typeof treatmentEditSchema>;

/** Its next due day (D259): a day, or none. */
export const nextDueSchema = z.object({ nextDueOn: optionalDay(words.nextDueLabel) });

export type NextDueInput = z.input<typeof nextDueSchema>;
export type NextDuePayload = z.output<typeof nextDueSchema>;

/** The next due day as its form checks it: today or later. */
export const nextDueFormSchema = (today: string) =>
  nextDueSchema.superRefine(({ nextDueOn }, ctx) => dueFromToday(nextDueOn, today, ctx));

/** The parts of a treatment a change saves (D251): its details, or its next due day. */
export const TREATMENT_PARTS = ["DETAILS", "NEXT_DUE"] as const;
export type TreatmentPart = (typeof TREATMENT_PARTS)[number];

/**
 * A change to a treatment (D251): what was typed, and the part as the screen
 * had read it, so a change made from an older copy is refused rather than
 * writing over another's.
 */
export const changeTreatmentSchema = z.discriminatedUnion(
  "part",
  [
    z.object({
      part: z.literal("DETAILS"),
      changes: treatmentEditSchema,
      seen: z.object({
        name: z.string(),
        description: z.string().nullable(),
        estimatedCostPaise: z.number().int().nullable(),
        doctorId: z.uuid(),
      }),
    }),
    z.object({
      part: z.literal("NEXT_DUE"),
      changes: nextDueSchema,
      seen: z.object({ nextDueOn: z.string().nullable() }),
    }),
  ],
  { error: VALIDATION_MESSAGES.invalid },
);

export type ChangeTreatmentInput = z.input<typeof changeTreatmentSchema>;
export type ChangeTreatmentPayload = z.output<typeof changeTreatmentSchema>;

/** Why a treatment is cancelled (D250): a line, or nothing. */
export const cancelTreatmentSchema = z.object({ reason: optionalLine(words.reasonLabel, TEXT_LIMITS.reason) });

export type CancelTreatmentInput = z.input<typeof cancelTreatmentSchema>;

/**
 * A treatment's status (plan §14.1; D250, D251): where it goes, from the
 * status the screen read; a reason only with a cancellation.
 */
export const treatmentStatusSchema = z
  .object({
    status: z.enum(TREATMENT_STATUSES, { error: VALIDATION_MESSAGES.invalid }),
    seen: z.enum(TREATMENT_STATUSES, { error: VALIDATION_MESSAGES.invalid }),
    reason: optionalLine(words.reasonLabel, TEXT_LIMITS.reason),
  })
  .superRefine(({ status, reason }, ctx) => {
    if (reason !== null && status !== "CANCELLED") {
      ctx.addIssue({ code: "custom", path: ["reason"], message: VALIDATION_MESSAGES.invalid });
    }
  });

export type TreatmentStatusInput = z.input<typeof treatmentStatusSchema>;
export type TreatmentStatusPayload = z.output<typeof treatmentStatusSchema>;

/** What a visit did for a treatment as its sheet holds it (D256, D257): a note, and whether it completes it. */
export const sessionFormSchema = z.object({
  note: optionalLines(words.noteLabel, TEXT_LIMITS.sessionNote),
  complete: z.boolean({ error: VALIDATION_MESSAGES.invalid }),
});

export type SessionFormInput = z.input<typeof sessionFormSchema>;

/** Saving it (D251, D257): the note as the screen had read it, or none before the first. */
export const treatmentSessionSchema = sessionFormSchema.extend({
  seen: z.object({ note: z.string().nullable() }).nullable(),
});

export type TreatmentSessionInput = z.input<typeof treatmentSessionSchema>;
export type TreatmentSessionPayload = z.output<typeof treatmentSessionSchema>;
