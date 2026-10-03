import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: [{ id: "e-1" }] })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useClosures } = await import("@/features/clinic/hooks/useClosures");

describe("useClosures", () => {
  it("reads holidays and leave, past ones too from its route", () => {
    const { result } = renderHook(() => useClosures());
    expect(useApiQuery).toHaveBeenCalledWith("/api/closures");
    expect(result.current.data).toEqual([{ id: "e-1" }]);
  });
});
