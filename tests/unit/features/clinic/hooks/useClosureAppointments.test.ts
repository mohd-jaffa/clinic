import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: { total: 0, appointments: [] } })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useClosureAppointments } = await import("@/features/clinic/hooks/useClosureAppointments");

// Today, in Kochi: 3 October 2026.
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("useClosureAppointments (D137)", () => {
  it("asks for the appointments on days that make a closure, who and the days in the address", () => {
    const { result } = renderHook(() =>
      useClosureAppointments({ who: "CLINIC", startsOn: "2026-10-20", endsOn: "2026-10-22" }),
    );
    expect(useApiQuery).toHaveBeenCalledWith(
      "/api/closures/appointments?who=CLINIC&startsOn=2026-10-20&endsOn=2026-10-22",
    );
    expect(result.current.data).toEqual({ total: 0, appointments: [] });
  });

  it("asks nothing for half a choice, or days a closure could not have", () => {
    renderHook(() => useClosureAppointments({ who: "CLINIC", startsOn: "2026-10-20", endsOn: "" }));
    renderHook(() => useClosureAppointments({ who: "CLINIC", startsOn: "2026-10-01", endsOn: "2026-10-02" }));
    expect(useApiQuery.mock.calls).toEqual([[null], [null]]);
  });
});
