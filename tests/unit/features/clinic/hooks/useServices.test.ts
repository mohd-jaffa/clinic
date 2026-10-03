import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: [{ id: "e-1" }] })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useServices } = await import("@/features/clinic/hooks/useServices");

describe("useServices", () => {
  it("reads the whole list from its route, archived entries too", () => {
    const { result } = renderHook(() => useServices());
    expect(useApiQuery).toHaveBeenCalledWith("/api/services");
    expect(result.current.data).toEqual([{ id: "e-1" }]);
  });
});
