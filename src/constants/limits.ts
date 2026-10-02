/**
 * The bounds a form or a route accepts (plan §26, AGENTS.md §27). These
 * protect columns and pages; a rule the platform admin may want to change is a
 * platform setting instead (plan §6), never a constant here.
 */

/**
 * How many rows a list asks for at a time (plan §10.2): enough to fill a phone
 * twice over; **Show more** brings the next as many.
 */
export const PAGE_SIZE = 20;

/** How far into a list a page may start — far past any list a clinic keeps. */
export const MAX_PAGE_START = 100_000;

/** What a list's search box may send. */
export const MAX_SEARCH_LENGTH = 100;
