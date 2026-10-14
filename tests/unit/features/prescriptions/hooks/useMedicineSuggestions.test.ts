import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useApiQuery } = vi.hoisted(() => ({ useApiQuery: vi.fn(() => ({ data: undefined })) }));
vi.mock("@/lib/query/useApiQuery", () => ({ useApiQuery }));

const { useMedicineSuggestions } = await import("@/features/prescriptions/hooks/useMedicineSuggestions");

const OPTIONS = { keepPreviousData: true, revalidateOnFocus: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("useMedicineSuggestions (D211)", () => {
  it("asks once the typing settles, with the doctor whose lines come first — and nothing for nothing typed", () => {
    const { rerender } = renderHook(({ typed }) => useMedicineSuggestions(typed, "d-1"), {
      initialProps: { typed: "" },
    });
    expect(useApiQuery).toHaveBeenLastCalledWith(null, OPTIONS);
    rerender({ typed: " para " });
    expect(useApiQuery).toHaveBeenLastCalledWith(null, OPTIONS);
    act(() => vi.advanceTimersByTime(300));
    expect(useApiQuery).toHaveBeenLastCalledWith("/api/prescriptions/medicines?q=para&doctorId=d-1", OPTIONS);
  });
});
