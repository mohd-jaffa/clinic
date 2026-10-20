import * as z from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { PAYMENT_KINDS, PAYMENT_METHODS } from "@/constants/statuses";
import { todayKey } from "@/lib/dates/calendar";

import { optionalLine, paiseText, requiredDay, requiredLine } from "../primitives";
import { cursorParam, dayRangeQuery } from "./list";

const { payment: words } = UI_TEXT;

const id = z.uuid({ error: VALIDATION_MESSAGES.invalid });

/**
 * A payment taken, or a refund handed back (plan §15.3; D297, D299, D322,
 * D324, D334): the patient, the amount — more than nothing — the day it was
 * paid, today or before it, never after; the method, a reference and a
 * note. Typed in rupees, read into paise. Whether a refund is within the
 * advance held is the database's to say (D297).
 */
export const paymentSchema = z
  .object({
    // Searched for and picked in the sheet (D323): none yet asks for one.
    patientId: z.uuid({ error: VALIDATION_MESSAGES.choose(UI_TEXT.appointments.patientLabel) }),
    kind: z.enum(PAYMENT_KINDS, { error: VALIDATION_MESSAGES.invalid }),
    amount: paiseText(words.amountLabel).refine((paise) => paise > 0, {
      message: VALIDATION_MESSAGES.moreThanZero(words.amountLabel),
    }),
    paidOn: requiredDay(words.paidOnLabel).refine((day) => day <= todayKey(), {
      message: VALIDATION_MESSAGES.notAfterToday(words.paidOnLabel),
    }),
    method: z.enum(PAYMENT_METHODS, { error: VALIDATION_MESSAGES.choose(words.methodLabel) }),
    reference: optionalLine(words.referenceLabel, TEXT_LIMITS.reference),
    note: optionalLine(words.noteLabel, TEXT_LIMITS.paymentNote),
  })
  .transform(({ amount, ...rest }) => ({ ...rest, amountPaise: amount }));

export type PaymentInput = z.input<typeof paymentSchema>;
export type PaymentPayload = z.output<typeof paymentSchema>;

/** Why a payment or a refund is voided (plan §15.3; D336): one line, before the card asks to be sure. */
export const voidPaymentSchema = z.object({
  reason: requiredLine(words.voidReasonLabel, { max: TEXT_LIMITS.reason }),
});

export type VoidPaymentInput = z.input<typeof voidPaymentSchema>;
export type VoidPaymentPayload = z.output<typeof voidPaymentSchema>;

/** A payment named in an address — the one voided. */
export const paymentIdSchema = id;

/** Billing's Payments tab (plan §15.4; D320, D335): its days, and where its page starts. */
export const paymentsQuerySchema = dayRangeQuery.and(z.object({ cursor: cursorParam }));

export type PaymentsQuery = z.output<typeof paymentsQuerySchema>;
