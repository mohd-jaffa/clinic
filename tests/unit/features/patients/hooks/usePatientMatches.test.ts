import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useApiLookup = vi.hoisted(() => vi.fn(() => ({ data: [] })));
vi.mock("@/lib/query/useApiLookup", () => ({ useApiLookup }));

const { usePatientMatches } = await import("@/features/patients/hooks/usePatientMatches");

beforeEach(() => useApiLookup.mockClear());

describe("usePatientMatches (D106)", () => {
  it("asks about a whole mobile, as it is stored", () => {
    renderHook(() => usePatientMatches("98765 43210"));
    expect(useApiLookup).toHaveBeenCalledWith("/api/patients/matches", { phone: "+919876543210" });
  });

  it("asks nothing about part of one", () => {
    renderHook(() => usePatientMatches("98765"));
    expect(useApiLookup).toHaveBeenCalledWith("/api/patients/matches", null);
  });
});
