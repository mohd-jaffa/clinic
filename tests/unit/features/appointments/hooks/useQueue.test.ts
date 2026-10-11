import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: [] })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useQueue } = await import("@/features/appointments/hooks/useQueue");

describe("useQueue (D34)", () => {
  it("reads the doctor's queue — or every doctor's — again every 15 s and on focus", () => {
    renderHook(() => useQueue("d-1"));
    expect(useApiQuery).toHaveBeenLastCalledWith("/api/queue?doctorId=d-1", {
      refreshInterval: 15_000,
      revalidateOnFocus: true,
    });
    renderHook(() => useQueue(""));
    expect(useApiQuery).toHaveBeenLastCalledWith("/api/queue", expect.any(Object));
  });
});
