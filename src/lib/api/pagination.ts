import { PAGE_SIZE } from "@/constants/limits";

/**
 * One page of a list (plan §10.2): its rows, and where the next page
 * starts — null on the last. Every paged route answers in this shape, and
 * `useApiPages` reads it.
 */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * The rows to ask the database for, as an inclusive range: one more than a
 * page, so the answer says whether another page follows without a count.
 */
export function pageWindow(start = 0): { from: number; to: number } {
  return { from: start, to: start + PAGE_SIZE };
}

/** The rows that came back for `pageWindow(start)`, as a page. */
export function toPage<T>(rows: readonly T[], start = 0): Page<T> {
  const more = rows.length > PAGE_SIZE;
  return {
    items: more ? rows.slice(0, PAGE_SIZE) : [...rows],
    nextCursor: more ? String(start + PAGE_SIZE) : null,
  };
}
