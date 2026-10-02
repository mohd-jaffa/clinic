"use client";

import type { ReactNode } from "react";

import { UI_TEXT, type ErrorMessageCode } from "@/constants/messages";
import { errorMessage } from "@/lib/errors/errorMessage";

import { Button } from "./button";
import { ScreenNotice } from "./screen-notice";
import { SkeletonRows } from "./skeleton";

/**
 * One list, every state of it (ported from Brio): rows to stand in while it
 * loads, the failure and a way to try again, the empty state, the rows, the
 * line for "nothing matches", and **Show more** while another page follows.
 * What a list needs to know about its query is what SWR returns, so a screen
 * passes its `useApiQuery` or `useApiPages` result straight in.
 */
export interface ListQuery {
  isLoading: boolean;
  error?: unknown;
  mutate?: () => unknown;
  isValidating?: boolean;
  /** A paged list (`useApiPages`): whether another page follows, and how to ask for it. */
  hasMore?: boolean;
  loadingMore?: boolean;
  loadMore?: () => void;
}

/**
 * A screen, or a part of one, that could not load (AGENTS.md §23): why, in
 * the app's words, and **Try again**. It stays on the screen rather than on a
 * response card, because the screen has nothing else to show.
 */
export function LoadFailed({ query, loadFailed }: { query: ListQuery; loadFailed: ErrorMessageCode }) {
  return (
    <section className="grid justify-items-start gap-4">
      <ScreenNotice>{errorMessage(query.error, loadFailed)}</ScreenNotice>
      {query.mutate && (
        <Button
          label={UI_TEXT.actions.retry}
          variant="secondary"
          loading={query.isValidating}
          onClick={() => query.mutate?.()}
        />
      )}
    </section>
  );
}

export function ListScreen<T>({
  query,
  loadFailed,
  data,
  empty,
  noMatches,
  renderList,
  children,
}: {
  query: ListQuery;
  /** The message shown when loading fails and the failure carries none of its own. */
  loadFailed: ErrorMessageCode;
  /** undefined until the first load has an answer; already filtered by the screen. */
  data: readonly T[] | undefined;
  /** Shown when the clinic has none of these yet — usually an EmptyState. */
  empty: ReactNode;
  /** Shown when there are some, but none match the current search. */
  noMatches?: string;
  /** The rows themselves — a RowList on a phone, a table on a desktop. */
  renderList: (items: readonly T[]) => ReactNode;
  /** Anything below the rows. */
  children?: ReactNode;
}) {
  if (query.isLoading && data === undefined) {
    return (
      <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
        <SkeletonRows />
      </section>
    );
  }

  if (query.error != null && data === undefined) return <LoadFailed query={query} loadFailed={loadFailed} />;

  if (!data || data.length === 0) {
    return (
      <section>{noMatches ? <p className="py-10 text-center font-bold text-muted">{noMatches}</p> : empty}</section>
    );
  }

  return (
    <section>
      {renderList(data)}
      {query.hasMore && query.loadMore && (
        <div className="mt-4 flex justify-center">
          <Button
            label={UI_TEXT.actions.showMore}
            variant="secondary"
            loading={query.loadingMore}
            onClick={query.loadMore}
          />
        </div>
      )}
      {children}
    </section>
  );
}
