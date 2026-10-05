"use client";

import { useCallback, useState } from "react";

import { useRevalidate } from "./useRevalidate";

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
  const refresh = useRevalidate();
  const [submitting, setSubmitting] = useState(false);

  const { revalidate, onSuccess, onError } = options;

  const submit = useCallback(
    async (input: TInput): Promise<TResult | undefined> => {
      setSubmitting(true);
      try {
        const result = await run(input);
        await refresh(revalidate ?? []);
        onSuccess?.(result);
        return result;
      } catch (failure) {
        onError?.(failure);
        return undefined;
      } finally {
        setSubmitting(false);
      }
    },
    [run, revalidate, onSuccess, onError, refresh],
  );

  return { submit, submitting };
}
