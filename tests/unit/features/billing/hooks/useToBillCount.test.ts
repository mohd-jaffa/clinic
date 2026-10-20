import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiQuery = vi.hoisted(() => vi.fn(() => ({ data: undefined })));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useToBillCount } = await import("@/features/billing/hooks/useToBillCount");

describe("useToBillCount (D337)", () => {
  it("counts every doctor's, or one doctor's, as often as the queue — and asks nothing of someone who may not", () => {
    renderHook(() => useToBillCount(true));
    expect(useApiQuery).toHaveBeenLastCalledWith("/api/to-bill/count", { refreshInterval: 15_000 });
    renderHook(() => useToBillCount(true, "d-1"));
    expect(useApiQuery).toHaveBeenLastCalledWith("/api/to-bill/count?doctorId=d-1", { refreshInterval: 15_000 });
    renderHook(() => useToBillCount(false));
    expect(useApiQuery).toHaveBeenLastCalledWith(null, { refreshInterval: 15_000 });
  });
});
