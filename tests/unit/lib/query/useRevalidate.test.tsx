import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import useSWR, { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";

import { useRevalidate } from "@/lib/query/useRevalidate";

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}

describe("useRevalidate", () => {
  it("refreshes every read of the routes named, searched ones too, and nothing else", async () => {
    const fetcher = vi.fn(async (key: string) => key);
    const { result } = renderHook(
      () => {
        useSWR("/api/patients/search", fetcher);
        useSWR("/api/patients/search?tab=ARCHIVED", fetcher);
        useSWR("/api/patients/p-1", fetcher);
        return useRevalidate();
      },
      { wrapper },
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    fetcher.mockClear();

    await act(() => result.current(["/api/patients/search", "/api/patients/matches"]));
    expect(fetcher.mock.calls.map(([key]) => key).sort()).toEqual([
      "/api/patients/search",
      "/api/patients/search?tab=ARCHIVED",
    ]);
  });
});
