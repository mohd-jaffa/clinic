"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";

// How SWR files a paged list (swr/_internal INFINITE_PREFIX): its first page's key, marked.
const PAGED = "$inf$";

/** A cache key's route: without the paged mark, and without its query. */
function routeOf(key: string): string {
  const bare = key.startsWith(PAGED) ? key.slice(PAGED.length) : key;
  return bare.split("?")[0];
}

/**
 * A write to the API, with the pieces of state every form around one was
 * keeping by hand: whether it is in flight, and what to refresh once it
 * worked. Each sheet had its own try/catch/finally around exactly this.
 *
 * `revalidate` names the routes whose data this change makes stale
 * (src/lib/query/keys.ts); on success every read of them is refreshed —
 * searched, filtered and paged ones too (`useApiPages`), whose keys carry a
 * query or a mark that a route alone would miss. What happened is the
 * caller's to report, on the response card (plan §32.2): `onSuccess` gets the
 * result and `onError` the failure, which `respond.failure` turns into the
 * API's own words and its request id.
 */
export function useApiMutation<TInput, TResult>(
  run: (input: TInput) => Promise<TResult>,
  options: {
    revalidate?: readonly string[];
    onSuccess?: (result: TResult) => void;
    onError?: (failure: unknown) => void;
  } = {},
) {
  const { mutate, cache } = useSWRConfig();
  const [submitting, setSubmitting] = useState(false);

  const { revalidate, onSuccess, onError } = options;

  const submit = useCallback(
    async (input: TInput): Promise<TResult | undefined> => {
      setSubmitting(true);
      try {
        const result = await run(input);
        const routes = new Set(revalidate ?? []);
        const stale = [...cache.keys()].filter((key) => routes.has(routeOf(key)));
        // A route nothing has read yet is still named, so a screen opened next starts fresh.
        await Promise.all([...new Set([...routes, ...stale])].map((key) => mutate(key)));
        onSuccess?.(result);
        return result;
      } catch (failure) {
        onError?.(failure);
        return undefined;
      } finally {
        setSubmitting(false);
      }
    },
    [run, revalidate, onSuccess, onError, mutate, cache],
  );

  return { submit, submitting };
}
