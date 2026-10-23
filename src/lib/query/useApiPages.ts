"use client";

import { useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";

import { fetcher, postJson } from "@/lib/api/client";
import type { Page } from "@/lib/api/pagination";

import { withQuery } from "./keys";
import { pageKey } from "./ServerData";
import { useSeeded } from "./useSeeded";

/**
 * A paged list from the API (plan §10.2): the first page, and the next
 * each time **Show more** is pressed. It answers in the shape `ListScreen`
 * reads, with the pages already joined.
 *
 * A new `key` starts again from its first page. Within one `list` — the
 * same tab or filter, searched for something else — the rows of the last key
 * stay on screen until the new ones arrive, so a list being searched does not
 * flash empty with every letter. Another list — another tab or filter, or a
 * hook that names none — shows its own rows if they have been read, and is
 * loading otherwise: never the last list's rows under its name (D191). Every
 * page shown is read again whenever the list is refreshed, so a change to one
 * row cannot leave a stale copy of it further down.
 *
 * A route whose page carries more than its rows — a list's count or
 * total — names its shape as `P`, and reads it from `first`.
 *
 * The joined rows are the same array until a page changes, so a screen can
 * hold them while something covers them (`useKept`).
 *
 * A first page the page arrived with (`ServerData`) is shown at once and not
 * asked for again on mount.
 *
 * `post`: a list searched for a patient (D98) — its key is held in memory
 * only, and each page is asked as a POST with the key's query as its body,
 * so what was typed never reaches an address.
 *
 * `refreshInterval`: a list kept fresh beside a screen that is (the queue's
 * To bill, D318), read again that often — never while the tab is hidden.
 */
export function useApiPages<T, P extends Page<T> = Page<T>>(
  key: string | null,
  { post = false, list, refreshInterval }: { post?: boolean; list?: string; refreshInterval?: number } = {},
) {
  const seeded = useSeeded(key === null ? null : pageKey(key));
  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<P>(
    (index, previous: P | null) => {
      if (key === null) return null;
      if (index === 0) return key;
      return previous?.nextCursor ? withQuery(key, { cursor: previous.nextCursor }) : null;
    },
    post ? posted : fetcher,
    { revalidateAll: true, ...(seeded && { revalidateOnMount: false }), ...(refreshInterval && { refreshInterval }) },
  );

  // The pages last read, and the list they are: what a search in the same
  // list shows until its own pages come.
  const [last, setLast] = useState<{ list?: string; pages: P[] } | null>(null);
  if (data !== undefined && last?.pages !== data) setLast({ list, pages: data });
  const pages = data ?? (list !== undefined && last?.list === list ? last.pages : undefined);

  const rows = useMemo(() => pages?.flatMap((page) => page.items), [pages]);
  const hasMore = Boolean(pages?.[pages.length - 1]?.nextCursor);
  return {
    data: rows,
    first: pages?.[0],
    error,
    isLoading,
    isValidating,
    mutate,
    hasMore,
    // Asked for a page that has not come yet — and there is one to come.
    loadingMore: hasMore && pages !== undefined && pages.length < size,
    loadMore: () => {
      if (hasMore) void setSize(size + 1);
    },
  };
}

/** A page asked as a POST: the key's route, its query as the body. */
function posted<T>(key: string): Promise<T> {
  const [route, query] = key.split("?");
  return postJson<T>(route, Object.fromEntries(new URLSearchParams(query)));
}
