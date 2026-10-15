import * as z from "zod";

import { MAX_PAGE_START, MAX_SEARCH_LENGTH } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";

import { optionalLine } from "../primitives";

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

/** The two every paged list takes. */
export const listQuerySchema = z.object({ cursor: cursorParam, search: searchParam });

export type ListQuery = z.output<typeof listQuerySchema>;

/**
 * Where a page of a patient's history starts (plan §10.3, D225): the
 * `nextCursor` the page before it gave — how many of their visits and of
 * their appointments are already shown, written "12.8"; anything else is
 * refused rather than read as the start.
 */
export const timelineCursorParam = z.optional(
  z
    .string()
    .regex(/^\d{1,6}\.\d{1,6}$/, { error: VALIDATION_MESSAGES.invalid })
    .transform((cursor) => {
      const [visits, appointments] = cursor.split(".").map(Number);
      return { visits, appointments };
    })
    .refine(({ visits, appointments }) => Math.max(visits, appointments) <= MAX_PAGE_START, {
      error: VALIDATION_MESSAGES.invalid,
    }),
);

/** A patient's history: where its page starts. */
export const timelineQuerySchema = z.object({ cursor: timelineCursorParam });
