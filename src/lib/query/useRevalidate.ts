"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";

// How SWR files a paged list (swr/_internal INFINITE_PREFIX): its first page's key, marked.
const PAGED = "$inf$";

/** A cache key's route: without the paged mark, and without its query. */
function routeOf(key: string): string {
  const bare = key.startsWith(PAGED) ? key.slice(PAGED.length) : key;
  return bare.split("?")[0];
}

/**
 * Refreshes every read of some routes (src/lib/query/keys.ts) — searched,
 * filtered and paged ones too (`useApiPages`), whose keys carry a query or a
 * mark that a route alone would miss. A route nothing has read yet is still
 * named, so a screen opened next starts fresh.
 */
export function useRevalidate() {
  const { mutate, cache } = useSWRConfig();
  return useCallback(
    async (routes: readonly string[]) => {
      const named = new Set(routes);
      const stale = [...cache.keys()].filter((key) => named.has(routeOf(key)));
      await Promise.all([...new Set([...named, ...stale])].map((key) => mutate(key)));
    },
    [mutate, cache],
  );
}
