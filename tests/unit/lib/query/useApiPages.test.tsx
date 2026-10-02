import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useApiPages } from "@/lib/query/useApiPages";

const fetcher = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ fetcher }));

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
});
