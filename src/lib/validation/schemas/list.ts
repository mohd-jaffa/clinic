import * as z from "zod";

import { MAX_PAGE_START, MAX_RANGE_DAYS, MAX_SEARCH_LENGTH } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { dayCount } from "@/lib/dates/calendar";

import { optionalLine, requiredDay } from "../primitives";

/**
 * Where a page of a list starts: the `nextCursor` the page before it gave
 * (plan §10.2). It is the count of rows already shown, written as digits;
 * anything else is refused rather than read as the start.
 */
export const cursorParam = z.optional(
  z
    .string()
    .regex(/^\d{1,6}$/, { error: VALIDATION_MESSAGES.invalid })
    .transform(Number)
    .refine((start) => start <= MAX_PAGE_START, { error: VALIDATION_MESSAGES.invalid }),
);

/** What a list is searched for, normalised like any line; blank is no search. */
export const searchParam = optionalLine("Search", MAX_SEARCH_LENGTH);

/** A list that pages and takes nothing else — Outstanding (plan §15.4). */
export const pageQuerySchema = z.object({ cursor: cursorParam });

export type PageQuery = z.output<typeof pageQuerySchema>;

/**
 * A list's days, From – To (D320): two days of the calendar, the last not
 * before the first, at most MAX_RANGE_DAYS apart, both counted.
 */
export const dayRangeQuery = z
  .object({ from: requiredDay(UI_TEXT.ranges.from), to: requiredDay(UI_TEXT.ranges.to) })
  .superRefine(({ from, to }, ctx) => {
    if (to < from) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: VALIDATION_MESSAGES.endsBeforeStart(UI_TEXT.ranges.to, UI_TEXT.ranges.from),
      });
    } else if (dayCount(from, to) > MAX_RANGE_DAYS) {
      ctx.addIssue({ code: "custom", path: ["to"], message: VALIDATION_MESSAGES.atMostRangeDays(MAX_RANGE_DAYS) });
    }
  });

/** The two every paged list takes. */
export const listQuerySchema = z.object({ cursor: cursorParam, search: searchParam });

export type ListQuery = z.output<typeof listQuerySchema>;

/**
 * Where a page of a patient's history starts (plan §10.3; D225, D325): the
 * `nextCursor` the page before it gave — how many of their visits, their
 * appointments, their bills and their payments are already shown, written
 * "12.8.3.5"; anything else is refused rather than read as the start.
 */
export const timelineCursorParam = z.optional(
  z
    .string()
    .regex(/^\d{1,6}(\.\d{1,6}){3}$/, { error: VALIDATION_MESSAGES.invalid })
    .transform((cursor) => {
      const [visits, appointments, bills, payments] = cursor.split(".").map(Number);
      return { visits, appointments, bills, payments };
    })
    .refine((shown) => Math.max(...Object.values(shown)) <= MAX_PAGE_START, {
      error: VALIDATION_MESSAGES.invalid,
    }),
);

/** A patient's history: where its page starts. */
export const timelineQuerySchema = z.object({ cursor: timelineCursorParam });
