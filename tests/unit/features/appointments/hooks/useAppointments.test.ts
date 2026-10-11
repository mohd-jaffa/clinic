import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: [] })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useAppointments } = await import("@/features/appointments/hooks/useAppointments");

describe("useAppointments", () => {
  it("reads the calendar's days for the doctor asked, as the page's first read is keyed", () => {
    renderHook(() => useAppointments("2026-10-13", "2026-10-13", ""));
    expect(useApiQuery).toHaveBeenCalledWith("/api/appointments?from=2026-10-13&to=2026-10-13");
  });
});
