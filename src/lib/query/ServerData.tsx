"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";

/**
 * A screen's first data, as the server read it while drawing the page, handed
 * to the hooks that would otherwise ask for it: `queries` by the key
 * `useApiQuery` reads, and `pages` as the first page of the `useApiPages` list
 * with that key. The screen draws with its data at once, and the hooks do not
 * ask again for what the page arrived with (`useSeeded`).
 *
 * It is a fallback, not the cache: anything the browser has read since wins,
 * and the data belongs to this page alone — when the page goes, so does it.
 */
export function ServerData({
  queries = {},
  pages = {},
  children,
}: {
  queries?: Record<string, unknown>;
  pages?: Record<string, unknown>;
  children: ReactNode;
}) {
  const fallback: Record<string, unknown> = { ...queries };
  for (const [key, first] of Object.entries(pages)) fallback[pageKey(key)] = [first];
  return <SWRConfig value={{ fallback }}>{children}</SWRConfig>;
}

/** Where SWR keeps the pages of the list at `key` (`useApiPages`). */
export function pageKey(key: string): string {
  return unstable_serialize(() => key);
}
