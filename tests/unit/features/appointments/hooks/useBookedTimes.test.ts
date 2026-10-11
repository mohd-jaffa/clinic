import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: [] })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useBookedTimes } = await import("@/features/appointments/hooks/useBookedTimes");

beforeEach(() => vi.clearAllMocks());

describe("useBookedTimes (D147)", () => {
  it("asks for the doctor's day once both are chosen, and nothing before", () => {
    renderHook(() => useBookedTimes("d-1", "2026-10-13"));
    renderHook(() => useBookedTimes("", "2026-10-13"));
    renderHook(() => useBookedTimes("d-1", ""));
    expect(useApiQuery.mock.calls).toEqual([["/api/appointments/booked?doctorId=d-1&date=2026-10-13"], [null], [null]]);
  });
});
