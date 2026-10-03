import { act, render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig, useSWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toSessionView } from "@/features/auth/session";
import type { AuthSessionView } from "@/features/auth/types";
import { aSession } from "@tests/support/auth";

const { fetcher, client, loadPage } = vi.hoisted(() => ({
  fetcher: vi.fn(),
  client: { signOut: vi.fn() },
  loadPage: vi.fn(),
}));
// Signing out loads a new page: nothing of the last account stays.
vi.mock("@/lib/navigation/url", () => ({ loadPage }));
vi.mock("@/lib/api/client", () => ({ fetcher }));
vi.mock("@/features/auth/api.client", () => ({ AuthClient: client }));

const { AuthProvider, useAuth } = await import("@/features/auth/AuthProvider");

const SESSION = toSessionView(aSession());

function arrivingWith(initial?: AuthSessionView | null) {
  return function wrapper({ children }: { children: ReactNode }) {
    return (
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, onError: () => {} }}
      >
        <AuthProvider initial={initial}>{children}</AuthProvider>
      </SWRConfig>
    );
  };
}

const session = (initial?: AuthSessionView | null) => renderHook(() => useAuth(), { wrapper: arrivingWith(initial) });

beforeEach(() => {
  vi.clearAllMocks();
  fetcher.mockReset();
  fetcher.mockResolvedValue(undefined);
  client.signOut.mockResolvedValue({ signedOut: true });
});

describe("who is signed in", () => {
  it("waits before deciding, rather than reporting nobody", () => {
    fetcher.mockImplementation(() => new Promise(() => {}));
    expect(session().result.current.status).toBe("loading");
  });

  it("reads the session from the server once, for the whole app: the person, their clinic and its plan", async () => {
    fetcher.mockResolvedValue(SESSION);

    const { result } = session();

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.profile?.fullName).toBe("Asha Menon");
    expect(result.current.membership?.clinicName).toBe("Smile Care");
    expect(result.current.subscription?.state).toBe("ACTIVE");
    expect(fetcher).toHaveBeenCalledWith("/api/auth/session");
  });

  it("treats a refused session as nobody being signed in", async () => {
    fetcher.mockRejectedValue(new Error("401"));

    const { result } = session();

    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    expect(result.current.profile).toBeNull();
    expect(result.current.membership).toBeNull();
    expect(result.current.subscription).toBeNull();
  });
});

describe("what the page arrived knowing", () => {
  it("is signed in at once when the server proved the session, and asks nothing", async () => {
    const { result } = session(SESSION);

    expect(result.current.status).toBe("authenticated");
    await new Promise((settle) => setTimeout(settle, 20));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("is signed out at once for a visitor with no session, and never asks to be refused", async () => {
    const { result } = session(null);

    expect(result.current.status).toBe("anonymous");
    await new Promise((settle) => setTimeout(settle, 20));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("asks when the server could not tell", async () => {
    fetcher.mockResolvedValue(SESSION);

    const { result } = session(undefined);

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
  });
});

describe("each account's reads", () => {
  it("are kept in a cache of their own, begun afresh when who is signed in changes", async () => {
    const caches: unknown[] = [];
    let auth: ReturnType<typeof useAuth> | undefined;
    function Probe() {
      caches.push(useSWRConfig().cache);
      auth = useAuth();
      return null;
    }
    const Wrapper = arrivingWith(SESSION);
    render(
      <Wrapper>
        <Probe />
      </Wrapper>,
    );
    const first = caches.at(-1);

    await act(() => auth!.signOut());

    expect(auth!.profile).toBeNull();
    expect(caches.at(-1)).not.toBe(first);
  });
});

describe("signing out", () => {
  it("forgets the session, stays signed out rather than falling back to the page's, and loads sign-in", async () => {
    const { result } = session(SESSION);

    await act(() => result.current.signOut());

    expect(client.signOut).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("anonymous");
    expect(loadPage).toHaveBeenCalledWith("/login");
  });

  it("forgets it even when the server could not be told", async () => {
    client.signOut.mockRejectedValue(new TypeError("Network down"));
    const { result } = session(SESSION);

    await act(() => expect(result.current.signOut()).rejects.toThrow("Network down"));

    expect(result.current.status).toBe("anonymous");
    expect(loadPage).toHaveBeenCalledWith("/login");
  });

  it("re-reads the session when asked", async () => {
    fetcher.mockResolvedValue(SESSION);
    const { result } = session(SESSION);

    await act(() => result.current.reload());

    expect(fetcher).toHaveBeenCalledWith("/api/auth/session");
  });

  it("refuses to be used without a provider, rather than reporting nobody is signed in", () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
