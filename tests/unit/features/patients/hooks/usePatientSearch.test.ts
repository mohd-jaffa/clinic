import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useApiLookup } = vi.hoisted(() => ({ useApiLookup: vi.fn(() => ({ data: undefined })) }));
vi.mock("@/lib/query/useApiLookup", () => ({ useApiLookup }));

const { usePatientSearch } = await import("@/features/patients/hooks/usePatientSearch");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("usePatientSearch (D144)", () => {
  it("asks the patients' search, in the body, once the typing settles — and nothing for nothing typed", () => {
    const { rerender } = renderHook(({ typed }) => usePatientSearch(typed), { initialProps: { typed: "" } });
    expect(useApiLookup).toHaveBeenLastCalledWith("/api/patients/search", null);
    rerender({ typed: " roh " });
    expect(useApiLookup).toHaveBeenLastCalledWith("/api/patients/search", null);
    act(() => vi.advanceTimersByTime(300));
    expect(useApiLookup).toHaveBeenLastCalledWith("/api/patients/search", { search: "roh", tab: "ALL" });
  });
});
