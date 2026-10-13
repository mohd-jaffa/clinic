import * as z from "zod";

import { VALIDATION_MESSAGES } from "@/constants/messages";
import { SEND_IN_CHOICES } from "@/constants/statuses";

/**
 * The queue's moves (plan §11.4, §30): each names the appointment it moves —
 * or, for Next patient, the doctor whose queue it is. Ids, never a patient, so
 * nothing here is personal; in the body all the same, as every write is.
 */
const appointmentId = z.uuid({ error: VALIDATION_MESSAGES.invalid });

/** Done, and Back to waiting: the appointment of the patient in. */
export const queueMoveSchema = z.object({ appointmentId });

export type QueueMovePayload = z.output<typeof queueMoveSchema>;

/**
 * Send in (D192): a waiting patient — and, while the doctor has someone in,
 * what becomes of them: marked done, or kept in. Without it, a busy room is
 * refused, so the desk is asked.
 */
export const sendInSchema = z.object({
  appointmentId,
  others: z.enum(SEND_IN_CHOICES, { error: VALIDATION_MESSAGES.invalid }).optional(),
});

export type SendInPayload = z.output<typeof sendInSchema>;

/** Next patient (D193, D196): the doctor's queue, and the patient it is for — none while the room is free. */
export const nextPatientSchema = z.object({
  doctorId: z.uuid({ error: VALIDATION_MESSAGES.invalid }),
  appointmentId: appointmentId.optional(),
});

export type NextPatientPayload = z.output<typeof nextPatientSchema>;

/** Stepped out, or back (D198): a waiting patient. */
export const steppedOutSchema = z.object({
  appointmentId,
  out: z.boolean({ error: VALIDATION_MESSAGES.invalid }),
});

export type SteppedOutPayload = z.output<typeof steppedOutSchema>;

/** Urgent, or not (D201): a patient waiting — or, to take it off, in. */
export const urgentSchema = z.object({
  appointmentId,
  urgent: z.boolean({ error: VALIDATION_MESSAGES.invalid }),
});

export type UrgentPayload = z.output<typeof urgentSchema>;
