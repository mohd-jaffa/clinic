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

/** A list with no search — a patient's history (plan §10.3): where its page starts. */
export const pageQuerySchema = z.object({ cursor: cursorParam });
