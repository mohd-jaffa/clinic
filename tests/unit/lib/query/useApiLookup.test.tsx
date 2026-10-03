import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useApiLookup } from "@/lib/query/useApiLookup";

const postJson = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ postJson }));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, onError: () => {} }}>
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  postJson.mockReset();
  postJson.mockResolvedValue([]);
});

describe("useApiLookup (D98)", () => {
  it("asks in the body of a POST, never in the address", async () => {
    postJson.mockResolvedValue([{ id: "p-1" }]);
    const { result } = renderHook(() => useApiLookup<{ id: string }[]>("/api/patients/matches", { phone: "+91987" }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual([{ id: "p-1" }]));
    expect(postJson).toHaveBeenCalledWith("/api/patients/matches", { phone: "+91987" });
  });

  it("asks nothing while there is nothing to ask", () => {
    const { result } = renderHook(() => useApiLookup("/api/patients/matches", null), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(postJson).not.toHaveBeenCalled();
  });

  it("holds each question apart", async () => {
    postJson.mockResolvedValueOnce("first");
    const { result, rerender } = renderHook(
      ({ phone }: { phone: string }) => useApiLookup<string>("/api/patients/matches", { phone }),
      { wrapper, initialProps: { phone: "+911" } },
    );
    await waitFor(() => expect(result.current.data).toBe("first"));
    postJson.mockResolvedValueOnce("second");
    rerender({ phone: "+912" });
    await waitFor(() => expect(result.current.data).toBe("second"));
    expect(postJson).toHaveBeenLastCalledWith("/api/patients/matches", { phone: "+912" });
  });
});
