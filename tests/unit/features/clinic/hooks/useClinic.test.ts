import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: { name: "Smile Care" } })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useClinic } = await import("@/features/clinic/hooks/useClinic");

describe("useClinic", () => {
  it("reads the clinic's profile from its route", () => {
    const { result } = renderHook(() => useClinic());
    expect(useApiQuery).toHaveBeenCalledWith("/api/clinic");
    expect(result.current.data).toEqual({ name: "Smile Care" });
  });
});
