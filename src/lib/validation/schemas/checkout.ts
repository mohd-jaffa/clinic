import * as z from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { BILL_LIST_STATES, NO_CHARGE_REASONS } from "@/constants/statuses";

import { optionalLine } from "../primitives";
import { cursorParam, dayRangeQuery } from "./list";

const { billing: words } = UI_TEXT;

const id = z.uuid({ error: VALIDATION_MESSAGES.invalid });

/** To bill (plan §15.6; D318): one doctor's visits, or every doctor's, and where the page starts. */
export const toBillQuerySchema = z.object({ doctorId: id.optional(), cursor: cursorParam });

export type ToBillQuery = z.output<typeof toBillQuerySchema>;

/** How many wait in To bill (D337): one doctor's, or every doctor's. */
export const toBillCountQuerySchema = z.object({ doctorId: id.optional() });

export type ToBillCountQuery = z.output<typeof toBillCountQuerySchema>;

/**
 * No charge (plan §15.6; D319): why the visit is free — a review, a
 * courtesy, or Other with a note, as the visit's CHECKs hold it.
 */
export const noChargeSchema = z
  .object({
    reason: z.enum(NO_CHARGE_REASONS, { error: VALIDATION_MESSAGES.choose(words.noChargeReasonLabel) }),
    note: optionalLine(words.noChargeNoteLabel, TEXT_LIMITS.reason),
  })
  .superRefine(({ reason, note }, ctx) => {
    if (reason === "OTHER" && note === null) {
      ctx.addIssue({ code: "custom", path: ["note"], message: VALIDATION_MESSAGES.required(words.noChargeNoteLabel) });
    }
  });

export type NoChargeInput = z.input<typeof noChargeSchema>;
export type NoChargePayload = z.output<typeof noChargeSchema>;

/** Billing's Bills tab (plan §15.4; D320, D335): its days, a state to keep to — or all — and where its page starts. */
export const billsQuerySchema = dayRangeQuery.and(
  z.object({
    state: z.enum(BILL_LIST_STATES, { error: VALIDATION_MESSAGES.invalid }).optional(),
    cursor: cursorParam,
  }),
);

export type BillsQuery = z.output<typeof billsQuerySchema>;
