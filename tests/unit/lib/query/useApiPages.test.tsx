import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useApiPages } from "@/lib/query/useApiPages";

const { fetcher, postJson } = vi.hoisted(() => ({ fetcher: vi.fn(), postJson: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ fetcher, postJson }));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, onError: () => {} }}>
      {children}
    </SWRConfig>
  );
}

const pages: Record<string, { items: string[]; nextCursor: string | null }> = {
  "/api/appointments?status=PENDING": { items: ["a", "b"], nextCursor: "2" },
  "/api/appointments?status=PENDING&cursor=2": { items: ["c"], nextCursor: null },
};

beforeEach(() => {
  fetcher.mockReset();
  fetcher.mockImplementation(async (key: string) => pages[key]);
  postJson.mockReset();
});

describe("useApiPages", () => {
  it("reads the first page, then the next when asked, joined", async () => {
    const { result } = renderHook(() => useApiPages<string>("/api/appointments?status=PENDING"), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(["a", "b"]));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loadingMore).toBe(false);

    act(() => result.current.loadMore());
    expect(result.current.loadingMore).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(["a", "b", "c"]));
    expect(fetcher).toHaveBeenCalledWith("/api/appointments?status=PENDING&cursor=2");
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loadingMore).toBe(false);
  });

  it("hands back the same rows until a page changes, so a screen can hold them", async () => {
    const { result, rerender } = renderHook(() => useApiPages<string>("/api/appointments?status=PENDING"), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(["a", "b"]));
    const rows = result.current.data;
    rerender();
    expect(result.current.data).toBe(rows);
  });

  it("hands back the first page whole, for a route that sends more than its rows", async () => {
    pages["/api/guest-sales"] = { items: ["g"], nextCursor: null, orders: 1 } as never;
    const { result } = renderHook(
      () => useApiPages<string, { items: string[]; nextCursor: string | null; orders: number }>("/api/guest-sales"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.first?.orders).toBe(1));
    expect(result.current.data).toEqual(["g"]);
  });

  it("does not ask for a page after the last", async () => {
    const { result } = renderHook(() => useApiPages<string>("/api/appointments?status=PENDING&cursor=2"), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(["c"]));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("drops a page that no longer follows when the list is read again", async () => {
    const { result } = renderHook(() => useApiPages<string>("/api/appointments?status=PENDING"), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(["a", "b"]));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data).toEqual(["a", "b", "c"]));

    // Another device finished an order: the first page is now the whole list.
    fetcher.mockImplementation(async () => ({ items: ["a"], nextCursor: null }));
    await act(async () => {
      await result.current.mutate();
    });
    await waitFor(() => expect(result.current.data).toEqual(["a"]));
    expect(result.current.hasMore).toBe(false);
  });

  it("reads the list again as often as it is told to, for a list kept fresh beside a screen (D318)", async () => {
    const { result } = renderHook(
      () => useApiPages<string>("/api/appointments?status=PENDING&cursor=2", { refreshInterval: 20 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toEqual(["c"]));
    await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  describe("while a new key's rows come (D191)", () => {
    /** Answers held until let go, so a test can look at the list while they come. */
    function held() {
      const waiting = new Map<string, (page: unknown) => void>();
      fetcher.mockImplementation((key: string) => new Promise((settle) => waiting.set(key, settle)));
      return (key: string, items: string[]) => act(async () => waiting.get(key)!({ items, nextCursor: null }));
    }

    function listOf(key: string, list?: string) {
      return renderHook(({ key: asked, list: named }) => useApiPages<string>(asked, { list: named }), {
        wrapper,
        initialProps: { key, list },
      });
    }

    it("keeps the last rows on screen while what is searched changes within the same list", async () => {
      const answer = held();
      const { result, rerender } = listOf("/api/patients?tab=ALL", "ALL");
      await answer("/api/patients?tab=ALL", ["Ravi", "Meena"]);
      await waitFor(() => expect(result.current.data).toEqual(["Ravi", "Meena"]));

      rerender({ key: "/api/patients?tab=ALL&search=me", list: "ALL" });
      expect(result.current.data).toEqual(["Ravi", "Meena"]);
      await answer("/api/patients?tab=ALL&search=me", ["Meena"]);
      await waitFor(() => expect(result.current.data).toEqual(["Meena"]));
    });

    it("shows another list loading, never the last list's rows, and its own rows at once once read", async () => {
      const answer = held();
      const { result, rerender } = listOf("/api/patients?tab=ALL", "ALL");
      await answer("/api/patients?tab=ALL", ["Ravi", "Meena"]);
      await waitFor(() => expect(result.current.data).toEqual(["Ravi", "Meena"]));

      rerender({ key: "/api/patients?tab=ARCHIVED", list: "ARCHIVED" });
      expect(result.current.data).toBeUndefined();
      expect(result.current.first).toBeUndefined();
      expect(result.current.isLoading).toBe(true);
      await answer("/api/patients?tab=ARCHIVED", ["Lakshmi"]);
      await waitFor(() => expect(result.current.data).toEqual(["Lakshmi"]));

      rerender({ key: "/api/patients?tab=ALL", list: "ALL" });
      expect(result.current.data).toEqual(["Ravi", "Meena"]);
    });

    it("keeps nothing for a hook that names no list", async () => {
      const answer = held();
      const { result, rerender } = listOf("/api/patients/p-1/timeline");
      await answer("/api/patients/p-1/timeline", ["first visit"]);
      await waitFor(() => expect(result.current.data).toEqual(["first visit"]));

      rerender({ key: "/api/patients/p-2/timeline", list: undefined });
      expect(result.current.data).toBeUndefined();
    });
  });

  it("waits while its key is unknown", () => {
    const { result } = renderHook(() => useApiPages<string>(null), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.hasMore).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps the failure for the screen to show", async () => {
    fetcher.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useApiPages<string>("/api/appointments"), { wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  });

  it("asks each page of a searched list as a POST, what was typed in the body and never the address (D98)", async () => {
    postJson.mockImplementation(async (_route: string, body: { cursor?: string }) =>
      body.cursor ? { items: ["Rohan"], nextCursor: null } : { items: ["Riya"], nextCursor: "20" },
    );
    const { result } = renderHook(() => useApiPages<string>("/api/patients/search?search=Mehta", { post: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual(["Riya"]));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.data).toEqual(["Riya", "Rohan"]));
    expect(postJson).toHaveBeenCalledWith("/api/patients/search", { search: "Mehta" });
    expect(postJson).toHaveBeenCalledWith("/api/patients/search", { search: "Mehta", cursor: "20" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("posts an empty body for a list asked with nothing", async () => {
    postJson.mockResolvedValue({ items: [], nextCursor: null });
    const { result } = renderHook(() => useApiPages<string>("/api/patients/search", { post: true }), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(postJson).toHaveBeenCalledWith("/api/patients/search", {});
  });
});
