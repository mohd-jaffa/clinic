import * as z from "zod";

import { VITAL_DECIMALS, VITAL_LIMITS, type VitalSign } from "@/constants/clinical";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { isDayKey } from "@/lib/dates/calendar";

import { optionalLines } from "../primitives";

const { vitals: labels, visit: words, appointment } = UI_TEXT;

/**
 * One reading typed into its field (plan §12.2): blank for none, else a
 * number within VITAL_LIMITS, to as many decimals as its column keeps —
 * "98.6" arrives as 98.6, "120.5" for blood pressure is refused in words.
 */
function reading(sign: VitalSign) {
  const label = labels[sign];
  const { min, max } = VITAL_LIMITS[sign];
  const places = VITAL_DECIMALS[sign];
  return z.string({ error: VALIDATION_MESSAGES.invalid }).transform((typed, ctx) => {
    const text = typed.trim();
    if (text === "") return null;
    const refuse = (message: string) => {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    };
    if (!/^\d{1,3}(\.\d+)?$/.test(text)) {
      return refuse(places === 0 ? VALIDATION_MESSAGES.wholeNumber(label) : VALIDATION_MESSAGES.number(label));
    }
    const decimals = text.split(".")[1]?.length ?? 0;
    if (decimals > places) {
      return refuse(
        places === 0 ? VALIDATION_MESSAGES.wholeNumber(label) : VALIDATION_MESSAGES.decimals(label, places),
      );
    }
    const value = Number(text);
    if (value < min || value > max) return refuse(VALIDATION_MESSAGES.between(label, min, max));
    return value;
  });
}

/**
 * A visit's vitals as typed (plan §12.2, D202): each reading may be left
 * blank, but blood pressure is both readings or neither, the upper higher —
 * as the vitals table's CHECK holds it.
 */
export const vitalsSchema = z
  .object({
    systolic: reading("systolic"),
    diastolic: reading("diastolic"),
    pulse: reading("pulse"),
    temperatureF: reading("temperatureF"),
    spo2: reading("spo2"),
    respiratoryRate: reading("respiratoryRate"),
    weightKg: reading("weightKg"),
    heightCm: reading("heightCm"),
  })
  .superRefine(({ systolic, diastolic }, ctx) => {
    if (systolic === null && diastolic === null) return;
    if (systolic !== null && diastolic !== null && diastolic < systolic) return;
    ctx.addIssue({
      code: "custom",
      path: [systolic === null ? "systolic" : "diastolic"],
      message: VALIDATION_MESSAGES.bloodPressure,
    });
  });

export type VitalsInput = z.input<typeof vitalsSchema>;
export type VitalsPayload = z.output<typeof vitalsSchema>;

/** A reading as the screen last read it: a number, or none. */
const seenReading = z.number({ error: VALIDATION_MESSAGES.invalid }).nullable();

/** The readings as the screen last read them (D206) — none when none were ever taken. */
const seenVitals = z
  .object({
    systolic: seenReading,
    diastolic: seenReading,
    pulse: seenReading,
    temperatureF: seenReading,
    spo2: seenReading,
    respiratoryRate: seenReading,
    weightKg: seenReading,
    heightCm: seenReading,
  })
  .nullable();

/** Saving the vitals (D202, D206): what was typed, and what the screen had read before. */
export const saveVitalsSchema = z.object({ vitals: vitalsSchema, seen: seenVitals });

export type SaveVitalsInput = z.input<typeof saveVitalsSchema>;
export type SaveVitalsPayload = z.output<typeof saveVitalsSchema>;

/** Complaint, diagnosis and notes (plan §12.2): each may be left blank; clinical text, bounded and tidied. */
export const visitNotesSchema = z.object({
  complaint: optionalLines(words.complaintLabel, TEXT_LIMITS.complaint),
  diagnosis: optionalLines(words.diagnosisLabel, TEXT_LIMITS.diagnosis),
  notes: optionalLines(words.notesLabel, TEXT_LIMITS.clinicalNotes),
});

export type VisitNotesInput = z.input<typeof visitNotesSchema>;
export type VisitNotesPayload = z.output<typeof visitNotesSchema>;

/** The follow-up date (D205): a day, or none. */
export const followUpSchema = z.object({
  followUpOn: z.string({ error: VALIDATION_MESSAGES.invalid }).transform((typed, ctx) => {
    const text = typed.trim();
    if (text === "") return null;
    if (isDayKey(text)) return text;
    ctx.addIssue({ code: "custom", message: VALIDATION_MESSAGES.day(words.followUpLabel) });
    return z.NEVER;
  }),
});

export type FollowUpInput = z.input<typeof followUpSchema>;
export type FollowUpPayload = z.output<typeof followUpSchema>;

/** The follow-up as its section checks it: after the visit's day, as the database holds it. */
export const followUpFormSchema = (visitDay: string) =>
  followUpSchema.superRefine(({ followUpOn }, ctx) => {
    if (followUpOn !== null && followUpOn <= visitDay) {
      ctx.addIssue({
        code: "custom",
        path: ["followUpOn"],
        message: VALIDATION_MESSAGES.afterVisit(words.followUpLabel),
      });
    }
  });

/** The sections a visit's own fields save in (D202). */
export const VISIT_SECTIONS = ["NOTES", "FOLLOW_UP"] as const;
export type VisitSection = (typeof VISIT_SECTIONS)[number];

/**
 * A change to one of a visit's sections (D202, D206): what was typed, and the
 * section as the screen had read it, so a save made from an older copy is
 * refused rather than writing over another's.
 */
export const visitChangeSchema = z.discriminatedUnion(
  "section",
  [
    z.object({
      section: z.literal("NOTES"),
      changes: visitNotesSchema,
      seen: z.object({
        complaint: z.string().nullable(),
        diagnosis: z.string().nullable(),
        notes: z.string().nullable(),
      }),
    }),
    z.object({
      section: z.literal("FOLLOW_UP"),
      changes: followUpSchema,
      seen: z.object({ followUpOn: z.string().nullable() }),
    }),
  ],
  { error: VALIDATION_MESSAGES.invalid },
);

export type VisitChangeInput = z.input<typeof visitChangeSchema>;
export type VisitChangePayload = z.output<typeof visitChangeSchema>;

/** New visit (D204): the patient, from their profile, and the doctor chosen. */
export const startVisitSchema = z.object({
  patientId: z.uuid({ error: VALIDATION_MESSAGES.invalid }),
  doctorId: z
    .union([z.uuid(), z.literal("")], { error: VALIDATION_MESSAGES.choose(appointment.doctorLabel) })
    .transform((id, ctx) => {
      if (id !== "") return id;
      ctx.addIssue({ code: "custom", message: VALIDATION_MESSAGES.choose(appointment.doctorLabel) });
      return z.NEVER;
    }),
});

export type StartVisitInput = z.input<typeof startVisitSchema>;
export type StartVisitPayload = z.output<typeof startVisitSchema>;
