"use client";

import useSWR from "swr";

import { postJson } from "@/lib/api/client";

import { withQuery } from "./keys";

/**
 * A read whose question is about a patient — a mobile, a name being searched
 * (D98): asked in the body of a POST, never in an address, so it reaches no
 * history, no server log and no hosting log. It is held like any read, in
 * memory only, under its route and what was asked — so a change that
 * refreshes the route refreshes it too (`useApiMutation`'s `revalidate`).
 *
 * `body` is null while there is nothing to ask yet; nothing is sent.
 */
export function useApiLookup<T>(route: string, body: Record<string, string> | null) {
  const key = body === null ? null : withQuery(route, body);
  const { data, error, isLoading, mutate } = useSWR<T>(key, () => postJson<T>(route, body));
  return { data, error, isLoading, mutate };
}
