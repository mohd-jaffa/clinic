import * as z from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { CONSOLE_CLINIC_FILTERS, EXTENSION_KINDS, PAYMENT_METHODS } from "@/constants/statuses";
import { todayKey } from "@/lib/dates/calendar";

import { optionalDay, optionalLine, optionalPaiseText } from "../primitives";
import { cursorParam, searchParam } from "./list";

const { console: words } = UI_TEXT;

/** The console's Clinics list (plan §20.2): what was typed, one filter, and where the page starts. */
export const consoleClinicsQuerySchema = z.object({
  search: searchParam,
  filter: z.enum(CONSOLE_CLINIC_FILTERS, { error: VALIDATION_MESSAGES.invalid }).optional(),
  cursor: cursorParam,
});

export type ConsoleClinicsQuery = z.output<typeof consoleClinicsQuerySchema>;

/**
 * Extend plan (plan §7.4; D373, D374). Monthly and Yearly are money
 * received: more than ₹0, the day it was paid — today or before — and how.
 * Set date takes the new last day and why, at any amount, ₹0 included; the
 * day paid and how count only when money came. A reference for any. Typed in
 * rupees, read into paise; what does not apply is sent as nothing.
 */
export const extendPlanSchema = z
  .object({
    kind: z.enum(EXTENSION_KINDS, { error: VALIDATION_MESSAGES.invalid }),
    amount: optionalPaiseText(words.amountLabel),
    paidOn: optionalDay(words.paidOnLabel),
    method: z.enum(PAYMENT_METHODS, { error: VALIDATION_MESSAGES.choose(words.methodLabel) }),
    reference: optionalLine(words.referenceLabel, TEXT_LIMITS.reference),
    validUntil: optionalDay(words.newLastDayLabel),
    reason: optionalLine(words.reasonLabel, TEXT_LIMITS.reason),
  })
  .superRefine(({ kind, amount, paidOn, validUntil, reason }, ctx) => {
    const refuse = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const custom = kind === "CUSTOM";
    if (!custom && !amount) {
      refuse(
        "amount",
        amount === null
          ? VALIDATION_MESSAGES.required(words.amountLabel)
          : VALIDATION_MESSAGES.moreThanZero(words.amountLabel),
      );
    }
    if (amount && paidOn === null) refuse("paidOn", VALIDATION_MESSAGES.required(words.paidOnLabel));
    if (amount && paidOn !== null && paidOn > todayKey()) {
      refuse("paidOn", VALIDATION_MESSAGES.notAfterToday(words.paidOnLabel));
    }
    if (custom && validUntil === null) refuse("validUntil", VALIDATION_MESSAGES.required(words.newLastDayLabel));
    if (custom && reason === null) refuse("reason", VALIDATION_MESSAGES.required(words.reasonLabel));
  })
  .transform(({ kind, amount, paidOn, method, reference, validUntil, reason }) => {
    const paid = amount !== null && amount > 0;
    return {
      kind,
      amountPaise: amount ?? 0,
      method: paid ? method : null,
      paidOn: paid ? paidOn : null,
      reference: paid ? reference : null,
      validUntil: kind === "CUSTOM" ? validUntil : null,
      reason,
    };
  });

export type ExtendPlanInput = z.input<typeof extendPlanSchema>;
export type ExtendPlanPayload = z.output<typeof extendPlanSchema>;
