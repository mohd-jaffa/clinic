"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { SWRConfig, useSWRConfig } from "swr";

import { AUTH_ROUTES } from "@/constants/routes";
import { loadPage } from "@/lib/navigation/url";
import { apiRoutes } from "@/lib/query/keys";
import { useApiQuery } from "@/lib/query/useApiQuery";

import { AuthClient } from "./api.client";
import type { AuthSessionView, SessionMembership, SessionProfile, SessionSubscription } from "./types";

/**
 * Who is signed in, for the whole app (plan §5.5, ported from Brio). The
 * session is read from the server once and shared, so no screen asks again
 * and no screen keeps its own copy that can go stale; the tokens behind it
 * stay in HttpOnly cookies and never reach this file.
 *
 * The page arrives knowing it where it can (`readInitialSession`): signed in,
 * the screen is drawn at once, without a round trip first; signed out,
 * nothing is asked, so a visitor on the sign-in screen is not answered with a
 * refusal. Only a session the server could not settle is read from here.
 */
export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  profile: SessionProfile | null;
  /** Their clinic, role and permissions; none for the platform admin. */
  membership: SessionMembership | null;
  subscription: SessionSubscription | null;
  signOut: () => Promise<void>;
  /** Re-reads the session — after a change to the person's own account. */
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type InitialSession = AuthSessionView | null | undefined;

export function AuthProvider({
  initial,
  children,
}: {
  /** What the server knew: the session, null for signed out, or undefined when it could not tell. */
  initial?: InitialSession;
  children: ReactNode;
}) {
  const { mutate: mutateAll, cache } = useSWRConfig();
  // The answer as it stands: a session is looked at again when the person
  // comes back to the app; nobody's is not.
  const cached = cache.get(apiRoutes.auth.session)?.data as InitialSession;
  const signedIn = Boolean(cached === undefined ? initial : cached);

  // A refusal gets no retries: it is the expected answer for a visitor with an
  // expired session, not a failure worth hammering the server over.
  const { data, error, isLoading, mutate } = useApiQuery<AuthSessionView | null>(apiRoutes.auth.session, {
    shouldRetryOnError: false,
    fallbackData: initial,
    revalidateOnMount: initial === undefined,
    revalidateOnFocus: signedIn,
    revalidateOnReconnect: signedIn,
  });

  const signOut = useCallback(async () => {
    try {
      await AuthClient.signOut();
    } finally {
      // Whatever the server said, this browser is done with the account. Its
      // cached reads must not be shown to the next one; nobody is said
      // outright and last, since an emptied session would fall back to the
      // one the page arrived with; and a new page, so nothing else of it
      // stays in memory either.
      await mutateAll(() => true, undefined, { revalidate: false });
      await mutate(null, { revalidate: false });
      loadPage(AUTH_ROUTES.signIn);
    }
  }, [mutate, mutateAll]);

  const reload = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const value = useMemo<AuthContextValue>(() => {
    const status: AuthStatus = data ? "authenticated" : isLoading && !error ? "loading" : "anonymous";
    return {
      status,
      profile: data?.profile ?? null,
      membership: data?.membership ?? null,
      subscription: data?.subscription ?? null,
      signOut,
      reload,
    };
  }, [data, error, isLoading, signOut, reload]);

  return (
    <AuthContext.Provider value={value}>
      {/* Each account's reads in a cache of their own, begun afresh whenever
          who is signed in changes: one account's rows can never be shown to
          the next, whatever path the change took. */}
      <SWRConfig key={value.profile?.id ?? SIGNED_OUT} value={ACCOUNT_CACHE}>
        {children}
      </SWRConfig>
    </AuthContext.Provider>
  );
}

const SIGNED_OUT = "signed-out";
const ACCOUNT_CACHE = { provider: () => new Map() };

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an AuthProvider.");
  return context;
}
