import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: undefined })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useAppointment } = await import("@/features/appointments/hooks/useAppointment");

describe("useAppointment", () => {
  it("reads the appointment open, and nothing while none is", () => {
    renderHook(() => useAppointment("a-1"));
    expect(useApiQuery).toHaveBeenLastCalledWith("/api/appointments/a-1");
    renderHook(() => useAppointment(null));
    expect(useApiQuery).toHaveBeenLastCalledWith(null);
  });
});
