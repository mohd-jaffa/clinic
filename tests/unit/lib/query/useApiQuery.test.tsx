import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useApiQuery } from "@/lib/query/useApiQuery";

const fetcher = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ fetcher }));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        shouldRetryOnError: false,
        // The screen shows the failure; nothing else needs to hear about it.
        onError: () => {},
      }}
    >
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  // Reset to something harmless: a revalidation left over from the test before
  // must not land in this one as an unhandled rejection.
  fetcher.mockReset();
  fetcher.mockResolvedValue(undefined);
});

describe("useApiQuery", () => {
  it("reads what the endpoint answers", async () => {
    fetcher.mockResolvedValue([{ id: "c-1" }]);

    const { result } = renderHook(() => useApiQuery<{ id: string }[]>("/api/customers"), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([{ id: "c-1" }]));
    expect(fetcher).toHaveBeenCalledWith("/api/customers");
  });

  it("keeps the failure for the screen to show", async () => {
    fetcher.mockImplementation(async () => {
      throw new Error("offline");
    });

    const { result } = renderHook(() => useApiQuery("/api/patients", { shouldRetryOnError: false }), { wrapper });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  });

  it("waits rather than fetching while the key is unknown", () => {
    renderHook(() => useApiQuery(null), { wrapper });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
