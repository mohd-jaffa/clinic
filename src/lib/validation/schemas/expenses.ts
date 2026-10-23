import * as z from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { PAYMENT_METHODS } from "@/constants/statuses";
import { todayKey } from "@/lib/dates/calendar";

import { optionalLine, paiseText, requiredDay } from "../primitives";
import { cursorParam, dayRangeQuery } from "./list";

const { expenses: words } = UI_TEXT;

const id = z.uuid({ error: VALIDATION_MESSAGES.invalid });

/**
 * An expense (plan §16; D328, D329, D343): its category — picked, none to
 * start — the amount, more than nothing, the day it was spent, today or
 * before it, never after; how it was paid, and what it was for, if the
 * category does not say. Typed in rupees, read into paise.
 */
export const expenseSchema = z
  .object({
    categoryId: z.uuid({ error: VALIDATION_MESSAGES.choose(words.categoryLabel) }),
    amount: paiseText(words.amountLabel).refine((paise) => paise > 0, {
      message: VALIDATION_MESSAGES.moreThanZero(words.amountLabel),
    }),
    day: requiredDay(words.dateLabel).refine((day) => day <= todayKey(), {
      message: VALIDATION_MESSAGES.notAfterToday(words.dateLabel),
    }),
    method: z.enum(PAYMENT_METHODS, { error: VALIDATION_MESSAGES.choose(words.methodLabel) }),
    description: optionalLine(words.descriptionLabel, TEXT_LIMITS.expenseDescription),
  })
  .transform(({ amount, ...rest }) => ({ ...rest, amountPaise: amount }));

export type ExpenseInput = z.input<typeof expenseSchema>;
export type ExpensePayload = z.output<typeof expenseSchema>;

/** An expense named in an address. */
export const expenseIdSchema = id;

/** An expense archived, or restored (D331). */
export const archiveExpenseSchema = z.object({ archived: z.boolean({ error: VALIDATION_MESSAGES.invalid }) });

export type ArchiveExpensePayload = z.output<typeof archiveExpenseSchema>;

/** Whether a query asks for the archived: "true" or nothing. */
const archivedParam = z
  .enum(["true", "false"], { error: VALIDATION_MESSAGES.invalid })
  .optional()
  .transform((value) => value === "true");

/**
 * A page of a month's expenses (plan §16; D330 – D332): its days, one
 * category or every one, those in use or those archived, and where the page
 * starts.
 */
export const expensesQuerySchema = dayRangeQuery.and(
  z.object({ categoryId: id.optional(), archived: archivedParam, cursor: cursorParam }),
);

export type ExpensesQuery = z.output<typeof expensesQuerySchema>;

/** A month's totals (D330): its days. */
export const expenseTotalsQuerySchema = dayRangeQuery;

export type ExpenseTotalsQuery = z.output<typeof expenseTotalsQuerySchema>;
