"use client";

import { useMemo } from "react";
import useSWRInfinite from "swr/infinite";

import { fetcher } from "@/lib/api/client";
import type { Page } from "@/lib/api/pagination";

import { withQuery } from "./keys";
import { pageKey } from "./ServerData";
import { useSeeded } from "./useSeeded";

/**
 * A paged list from the API (plan §10.2): the first page, and the next
 * each time **Show more** is pressed. It answers in the shape `ListScreen`
 * reads, with the pages already joined.
 *
 * A new `key` — another search, another tab — starts again from its first
 * page, while the rows of the last one stay on screen until it arrives, so a
 * list being searched does not flash empty with every letter. Every page shown
 * is read again whenever the list is refreshed, so a change to one row cannot
 * leave a stale copy of it further down.
 *
 * A route whose page carries more than its rows — a list's count or
 * total — names its shape as `P`, and reads it from `first`.
 *
 * The joined rows are the same array until a page changes, so a screen can
 * hold them while something covers them (`useKept`).
 *
 * A first page the page arrived with (`ServerData`) is shown at once and not
 * asked for again on mount.
 */
export function useApiPages<T, P extends Page<T> = Page<T>>(key: string | null) {
  const seeded = useSeeded(key === null ? null : pageKey(key));
  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<P>(
    (index, previous: P | null) => {
      if (key === null) return null;
      if (index === 0) return key;
      return previous?.nextCursor ? withQuery(key, { cursor: previous.nextCursor }) : null;
    },
    fetcher,
    { revalidateAll: true, keepPreviousData: true, ...(seeded && { revalidateOnMount: false }) },
  );

  const rows = useMemo(() => data?.flatMap((page) => page.items), [data]);
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);
  return {
    data: rows,
    first: data?.[0],
    error,
    isLoading,
    isValidating,
    mutate,
    hasMore,
    // Asked for a page that has not come yet — and there is one to come.
    loadingMore: hasMore && data !== undefined && data.length < size,
    loadMore: () => {
      if (hasMore) void setSize(size + 1);
    },
  };
}
