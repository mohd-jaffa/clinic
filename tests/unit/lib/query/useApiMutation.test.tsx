import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import useSWR, { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const pagedFetcher = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  fetcher: pagedFetcher,
}));

import { useApiMutation } from "@/lib/query/useApiMutation";
import { useApiPages } from "@/lib/query/useApiPages";

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

describe("useApiMutation", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useApiMutation(vi.fn()), { wrapper });
    expect(result.current.submitting).toBe(false);
  });

  it("hands back what came back and tells the caller it worked", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const run = vi.fn().mockResolvedValue({ id: "c-1" });

    const { result } = renderHook(() => useApiMutation(run, { onSuccess, onError }), { wrapper });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.submit({ name: "Meena" });
    });

    expect(run).toHaveBeenCalledWith({ name: "Meena" });
    expect(returned).toEqual({ id: "c-1" });
    expect(onSuccess).toHaveBeenCalledWith({ id: "c-1" });
    expect(onError).not.toHaveBeenCalled();
  });

  it("hands a refusal to the caller to report, and returns nothing", async () => {
    const refusal = new ApiError(409, "CONFLICT", "That phone number is taken.", "req_1");
    const onError = vi.fn();
    const run = vi.fn(() => Promise.reject(refusal));

    const { result } = renderHook(() => useApiMutation(run, { onError }), { wrapper });

    let returned: unknown = "unset";
    await act(async () => {
      returned = await result.current.submit(undefined);
    });

    expect(onError).toHaveBeenCalledWith(refusal);
    expect(returned).toBeUndefined();
    expect(result.current.submitting).toBe(false);
  });

  it("does not leave the form stuck submitting after a failure nobody listens for", async () => {
    const run = vi.fn(() => Promise.reject(new Error("nope")));
    const { result } = renderHook(() => useApiMutation(run), { wrapper });

    await act(async () => {
      await result.current.submit(undefined);
    });

    expect(result.current.submitting).toBe(false);
  });

  it("refreshes the routes the change made stale before saying it worked", async () => {
    const order: string[] = [];
    const run = vi.fn().mockResolvedValue("ok");
    const onSuccess = vi.fn(() => order.push("success"));
    const fetcher = vi.fn(async (key: string) => {
      order.push(`refresh ${key}`);
      return [];
    });
    const { result } = renderHook(() => useApiMutation(run, { revalidate: ["/api/customers"], onSuccess }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SWRConfig value={{ provider: () => new Map(), fetcher }}>{children}</SWRConfig>
      ),
    });

    await act(async () => {
      await result.current.submit(undefined);
    });

    expect(order.at(-1)).toBe("success");
  });

  it("refreshes every read of a stale route — searched and paged ones too — and leaves the rest", async () => {
    const reads: string[] = [];
    const fetcher = vi.fn(async (key: string) => {
      reads.push(key);
      return key.includes("search=y") ? { items: [], nextCursor: null } : [];
    });
    pagedFetcher.mockImplementation(fetcher);
    const run = vi.fn().mockResolvedValue("ok");
    const { result } = renderHook(
      () => {
        useSWR("/api/customers?search=x");
        useSWR("/api/patients");
        useApiPages("/api/customers?search=y");
        return useApiMutation(run, { revalidate: ["/api/customers"] });
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <SWRConfig value={{ provider: () => new Map(), fetcher, dedupingInterval: 0 }}>{children}</SWRConfig>
        ),
      },
    );
    await waitFor(() => expect(reads).toHaveLength(3));
    reads.length = 0;

    await act(async () => {
      await result.current.submit(undefined);
    });

    await waitFor(() =>
      expect(reads).toEqual(expect.arrayContaining(["/api/customers?search=x", "/api/customers?search=y"])),
    );
    expect(reads).not.toContain("/api/patients");
  });
});
