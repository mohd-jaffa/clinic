import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: [{ id: "e-1" }] })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useAppointmentTypes } = await import("@/features/clinic/hooks/useAppointmentTypes");

describe("useAppointmentTypes", () => {
  it("reads the whole list from its route, archived entries too", () => {
    const { result } = renderHook(() => useAppointmentTypes());
    expect(useApiQuery).toHaveBeenCalledWith("/api/appointment-types");
    expect(result.current.data).toEqual([{ id: "e-1" }]);
  });
});
