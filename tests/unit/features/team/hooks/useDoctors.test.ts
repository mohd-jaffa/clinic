import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: [{ id: "e-1" }] })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useDoctors } = await import("@/features/team/hooks/useDoctors");

describe("useDoctors", () => {
  it("reads the clinic's active doctors from its route", () => {
    const { result } = renderHook(() => useDoctors());
    expect(useApiQuery).toHaveBeenCalledWith("/api/doctors");
    expect(result.current.data).toEqual([{ id: "e-1" }]);
  });
});
