"use client";

import { useSWRConfig } from "swr";

/**
 * Whether what SWR shows for `key` is the data the page arrived with
 * (`ServerData`) rather than anything the browser has read since: there is
 * page data for it, and the cache holds that same data, or nothing yet. Such
 * data is as fresh as the page, so asking for it again the moment the screen
 * mounts would only read it twice.
 */
export function useSeeded(key: string | null): boolean {
  const { fallback, cache } = useSWRConfig();
  if (key === null || fallback?.[key] === undefined) return false;
  const held = cache.get(key)?.data;
  return held === undefined || held === fallback[key];
}
