"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SWRConfig, useSWRConfig, type Cache, type State } from "swr";
import { unstable_serialize } from "swr/infinite";

type Reads = Record<string, unknown>;

/** What one arrival of the page's data put where the hooks look for it. */
interface Arrival {
  visit: string;
  queries: Reads;
  pages: Reads;
  fallback: Reads;
}

const NONE: Reads = {};

// The visits (Next's `bfcacheId`) whose page has been shown. A new visit to a
// screen is a new id, its page just read; Back and Forward bring a page back
// under the id it was first shown with, as it was read then.
const shown = new Set<string>();

/**
 * A screen's first data, as the server read it while drawing the page, handed
 * to the hooks that would otherwise ask for it: `queries` by the key
 * `useApiQuery` reads, and `pages` as the first page of the `useApiPages` list
 * with that key. The screen draws with its data at once, and the hooks do not
 * ask again for what the page arrived with (`useSeeded`).
 *
 * The server has just read it, so it replaces whatever the browser kept from
 * the last visit: a screen opened again shows what is true now, without a
 * flash of what was, and is not read twice. A list starts again from its
 * first page. A page brought back by Back or Forward was read when it was
 * first shown, so it changes nothing: the screen shows what the browser has
 * and asks again.
 */
export function ServerData({
  queries = NONE,
  pages = NONE,
  children,
}: {
  queries?: Reads;
  pages?: Reads;
  children: ReactNode;
}) {
  const { cache } = useSWRConfig();
  const { bfcacheId: visit } = useRouter();
  const [arrival, setArrival] = useState<Arrival | null>(null);
  let current = arrival;
  if (current?.visit !== visit || current.queries !== queries || current.pages !== pages) {
    current = arrive(cache, visit, queries, pages);
    setArrival(current);
  }
  // Marked once shown, not while drawing: a draw React sets aside is not a visit.
  useEffect(() => {
    shown.add(visit);
  }, [visit]);
  return <SWRConfig value={{ fallback: current.fallback }}>{children}</SWRConfig>;
}

/** Where SWR keeps the pages of the list at `key` (`useApiPages`). */
export function pageKey(key: string): string {
  return unstable_serialize(() => key);
}

/** Puts a new visit's data in the cache; a visit shown before changes nothing. */
function arrive(cache: Cache, visit: string, queries: Reads, pages: Reads): Arrival {
  const fallback: Reads = {};
  if (!shown.has(visit)) {
    for (const [key, data] of Object.entries(queries)) {
      fallback[key] = data;
      keep(cache, key, data);
    }
    for (const [key, first] of Object.entries(pages)) {
      const list = pageKey(key);
      fallback[list] = [first];
      // Its page count too: the pages shown last time are not read again.
      keep(cache, list, fallback[list], { _l: undefined });
    }
  }
  return { visit, queries, pages, fallback };
}

function keep(cache: Cache, key: string, data: unknown, list: { _l?: number } = {}) {
  const entry: State & { _l?: number } = { ...cache.get(key), ...list, data, error: undefined };
  cache.set(key, entry);
}
