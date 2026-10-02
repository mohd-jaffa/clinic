"use client";

import { useSWRConfig } from "swr";

/**
 * Whether what SWR shows for `key` is the data the page arrived with
 * (`ServerData`) rather than anything the browser has read: there is a
 * fallback for it, and nothing in the cache yet. Such data is as fresh as the
 * page, so asking for it again the moment the screen mounts would only read
 * it twice.
 */
export function useSeeded(key: string | null): boolean {
  const { fallback, cache } = useSWRConfig();
  if (key === null || fallback?.[key] === undefined) return false;
  return cache.get(key)?.data === undefined;
}
