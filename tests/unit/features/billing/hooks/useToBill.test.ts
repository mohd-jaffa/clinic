import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useApiPages = vi.hoisted(() => vi.fn(() => ({ data: [] })));
vi.mock("@/lib/query/useApiPages", () => ({ useApiPages }));

const { useToBill } = await import("@/features/billing/hooks/useToBill");

describe("useToBill (plan §15.6; D318)", () => {
  it("asks for every doctor's visits to bill, or one doctor's, each its own list", () => {
    renderHook(() => useToBill());
    expect(useApiPages).toHaveBeenLastCalledWith("/api/to-bill", { list: "" });
    renderHook(() => useToBill("d-1"));
    expect(useApiPages).toHaveBeenLastCalledWith("/api/to-bill?doctorId=d-1", { list: "d-1" });
  });
});
