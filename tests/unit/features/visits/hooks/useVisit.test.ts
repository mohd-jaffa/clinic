import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: undefined })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useVisit } = await import("@/features/visits/hooks/useVisit");

describe("useVisit (D195)", () => {
  it("reads the visit's header again as the queue is: every 15 s and on focus", () => {
    renderHook(() => useVisit("v-1"));
    expect(useApiQuery).toHaveBeenLastCalledWith("/api/visits/v-1", {
      refreshInterval: 15_000,
      revalidateOnFocus: true,
    });
  });
});
